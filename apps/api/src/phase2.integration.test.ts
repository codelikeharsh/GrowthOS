import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { getDatabaseClient, InvitationStatus, RoleName, UserStatus } from '@growthos/db'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppModule } from './app.module.js'
import { createApplication } from './app.js'
import { setApiEnvironmentForTest } from './environment.js'
import { hashPassword, hashToken } from './security.js'

interface TestResponse {
  statusCode: number
  body: string
  json(): unknown
  cookies: { name: string; value: string }[]
}

class CookieJar {
  private readonly values = new Map<string, string>()

  update(response: TestResponse): void {
    for (const cookie of response.cookies) this.values.set(cookie.name, cookie.value)
  }

  header(): string {
    return [...this.values].map(([name, value]) => `${name}=${value}`).join('; ')
  }

  csrf(): string {
    return this.values.get('growthos_csrf') ?? ''
  }
}

describe.sequential('Phase 2 identity and tenant integration', () => {
  const database = getDatabaseClient()
  const marker = `${String(Date.now())}-${Math.random().toString(16).slice(2)}`
  const ownerEmail = `owner-${marker}@example.test`
  const outsiderEmail = `outsider-${marker}@example.test`
  const invitedEmail = `invited-${marker}@example.test`
  const password = 'StrongPassword!42'
  const nextPassword = 'DifferentPassword!84'
  let app: NestFastifyApplication
  let ownerId = ''
  let organizationId = ''
  let invitedId = ''
  const ownerJar = new CookieJar()
  const outsiderJar = new CookieJar()

  beforeAll(async () => {
    setApiEnvironmentForTest({
      NODE_ENV: 'test',
      LOG_LEVEL: 'error',
      API_PORT: 3001,
      API_CORS_ORIGINS: ['http://localhost:3000'],
      DATABASE_URL: process.env.DATABASE_URL ?? '',
      REDIS_URL: process.env.REDIS_URL ?? '',
      PUBLIC_WEB_URL: 'http://localhost:3000',
      SESSION_COOKIE_NAME: 'growthos_session',
      CSRF_COOKIE_NAME: 'growthos_csrf',
      SESSION_TTL_HOURS: 168,
      EMAIL_VERIFICATION_TTL_MINUTES: 60,
      PASSWORD_RESET_TTL_MINUTES: 30,
      INVITATION_TTL_HOURS: 72,
      LOGIN_RATE_LIMIT: 5,
      PASSWORD_RESET_RATE_LIMIT: 100,
      AUTH_RATE_LIMIT_WINDOW_SECONDS: 60,
      MAILPIT_SMTP_HOST: 'localhost',
      MAILPIT_SMTP_PORT: 1025,
      MAIL_FROM: 'no-reply@growthos.local',
      OPENAPI_ENABLED: false,
    })
    app = await createApplication(AppModule)
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  afterAll(async () => {
    if (organizationId) await database.organization.deleteMany({ where: { id: organizationId } })
    await database.user.deleteMany({
      where: { email: { in: [ownerEmail, outsiderEmail, invitedEmail] } },
    })
    await app.close()
    setApiEnvironmentForTest(undefined)
  })

  async function request(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    body?: object,
    jar?: CookieJar,
    csrf = true,
  ): Promise<TestResponse> {
    const response = await app.inject({
      method,
      url,
      ...(body ? { payload: body } : {}),
      headers: {
        ...(jar?.header() ? { cookie: jar.header() } : {}),
        ...(jar && csrf && !['GET'].includes(method) ? { 'x-csrf-token': jar.csrf() } : {}),
      },
    })
    const typed = response as unknown as TestResponse
    jar?.update(typed)
    return typed
  }

  async function createVerifiedUser(email: string): Promise<string> {
    const user = await database.user.create({
      data: {
        email,
        displayName: email.split('@')[0] ?? 'Test user',
        passwordHash: await hashPassword(password),
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    })
    return user.id
  }

  it('registers with Argon2id, verifies email, rejects a bad password, and creates opaque cookies', async () => {
    const registered = await request('POST', '/api/v1/auth/register', {
      email: ownerEmail,
      displayName: 'Phase Two Owner',
      password,
    })
    expect(registered.statusCode, registered.body).toBe(201)
    const user = await database.user.findUniqueOrThrow({ where: { email: ownerEmail } })
    ownerId = user.id
    expect(user.passwordHash).toMatch(/^\$argon2id\$/)
    expect(user.passwordHash).not.toContain(password)
    expect(user.status).toBe(UserStatus.PENDING_VERIFICATION)

    const verificationToken = `verification-${marker}-abcdefghijklmnopqrstuvwxyz`
    await database.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(verificationToken),
        expiresAt: new Date(Date.now() + 60_000),
      },
    })
    const verified = await request('POST', '/api/v1/auth/verify-email', {
      token: verificationToken,
    })
    expect(verified.statusCode, verified.body).toBe(200)

    const badLogin = await request('POST', '/api/v1/auth/login', {
      email: ownerEmail,
      password: 'incorrect',
    })
    expect(badLogin.statusCode).toBe(401)
    expect(badLogin.body).toContain('Invalid email or password')

    const login = await request(
      'POST',
      '/api/v1/auth/login',
      { email: ownerEmail, password },
      ownerJar,
    )
    expect(login.statusCode, login.body).toBe(200)
    expect(ownerJar.csrf()).not.toBe('')
    const session = await database.session.findFirstOrThrow({
      where: { userId: ownerId, revokedAt: null },
    })
    expect(session.tokenHash).toHaveLength(64)
    expect(ownerJar.header()).not.toContain(session.tokenHash)
  })

  it('enforces CSRF and rejects cross-tenant resource access', async () => {
    const noCsrf = await request(
      'POST',
      '/api/v1/organizations',
      { name: 'Forbidden CSRF Org', type: 'AGENCY' },
      ownerJar,
      false,
    )
    expect(noCsrf.statusCode).toBe(401)

    const created = await request(
      'POST',
      '/api/v1/organizations',
      { name: 'Phase Two Agency', type: 'AGENCY' },
      ownerJar,
    )
    expect(created.statusCode, created.body).toBe(201)
    organizationId = (created.json() as { id: string }).id

    await createVerifiedUser(outsiderEmail)
    const outsiderLogin = await request(
      'POST',
      '/api/v1/auth/login',
      { email: outsiderEmail, password },
      outsiderJar,
    )
    expect(outsiderLogin.statusCode).toBe(200)
    const guessed = await request(
      'GET',
      `/api/v1/organizations/${organizationId}`,
      undefined,
      outsiderJar,
    )
    expect(guessed.statusCode).toBe(404)
    expect(guessed.body).not.toContain('Phase Two Agency')
    const outsiderOrganizations = await request(
      'GET',
      '/api/v1/organizations',
      undefined,
      outsiderJar,
    )
    expect(outsiderOrganizations.json()).toEqual({ organizations: [] })
  })

  it('rotates sessions and rate-limits repeated login failures', async () => {
    const oldSession = await database.session.findFirstOrThrow({
      where: { userId: ownerId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    })
    const rotated = await request(
      'POST',
      '/api/v1/auth/login',
      { email: ownerEmail, password },
      ownerJar,
    )
    expect(rotated.statusCode, rotated.body).toBe(200)
    const oldAfterRotation = await database.session.findUniqueOrThrow({
      where: { id: oldSession.id },
    })
    expect(oldAfterRotation.revokedAt).not.toBeNull()
    expect(oldAfterRotation.replacedBySessionId).not.toBeNull()

    const limitedEmail = `limited-${marker}@example.test`
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const rejected = await request('POST', '/api/v1/auth/login', {
        email: limitedEmail,
        password: 'WrongPassword!42',
      })
      expect(rejected.statusCode).toBe(401)
    }
    const limited = await request('POST', '/api/v1/auth/login', {
      email: limitedEmail,
      password: 'WrongPassword!42',
    })
    expect(limited.statusCode).toBe(429)
  })

  it('enforces invitation email matching and removes an owner without retaining a privileged session', async () => {
    const ownerRole = await database.role.findUniqueOrThrow({ where: { name: RoleName.OWNER } })
    const rawOwnerInvite = `owner-invitation-${marker}-abcdefghijklmnopqrstuvwxyz`
    const ownerInvite = await database.organizationInvitation.create({
      data: {
        organizationId,
        email: outsiderEmail,
        roleId: ownerRole.id,
        tokenHash: hashToken(rawOwnerInvite),
        invitedById: ownerId,
        status: InvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 60_000),
      },
    })
    const wrongEmail = await request(
      'POST',
      '/api/v1/invitations/accept',
      { token: rawOwnerInvite },
      ownerJar,
    )
    expect(wrongEmail.statusCode).toBe(401)
    expect(
      (await database.organizationInvitation.findUniqueOrThrow({ where: { id: ownerInvite.id } }))
        .status,
    ).toBe(InvitationStatus.PENDING)

    const accepted = await request(
      'POST',
      '/api/v1/invitations/accept',
      { token: rawOwnerInvite },
      outsiderJar,
    )
    expect(accepted.statusCode, accepted.body).toBe(200)
    const outsider = await database.user.findUniqueOrThrow({ where: { email: outsiderEmail } })
    const membership = await database.organizationMember.findUniqueOrThrow({
      where: { organizationId_userId: { organizationId, userId: outsider.id } },
    })
    const removed = await request(
      'DELETE',
      `/api/v1/organizations/${organizationId}/members/${membership.id}`,
      undefined,
      ownerJar,
    )
    expect(removed.statusCode, removed.body).toBe(200)
    expect((await request('GET', '/api/v1/me', undefined, outsiderJar)).statusCode).toBe(401)
    const outsiderRelogin = await request(
      'POST',
      '/api/v1/auth/login',
      { email: outsiderEmail, password },
      outsiderJar,
    )
    expect(outsiderRelogin.statusCode).toBe(200)
    expect(
      (await request('GET', `/api/v1/organizations/${organizationId}`, undefined, outsiderJar))
        .statusCode,
    ).toBe(404)
  })

  it('accepts a new-user invitation, applies viewer RBAC, and revokes sessions after removal', async () => {
    const memberRole = await database.role.findUniqueOrThrow({ where: { name: RoleName.MEMBER } })
    const rawToken = `invitation-${marker}-abcdefghijklmnopqrstuvwxyz`
    await database.organizationInvitation.create({
      data: {
        organizationId,
        email: invitedEmail,
        roleId: memberRole.id,
        tokenHash: hashToken(rawToken),
        invitedById: ownerId,
        status: InvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 60_000),
      },
    })
    const invitedJar = new CookieJar()
    const accepted = await request(
      'POST',
      '/api/v1/invitations/accept',
      { token: rawToken, displayName: 'Invited Member', password },
      invitedJar,
    )
    expect(accepted.statusCode, accepted.body).toBe(200)
    const invited = await database.user.findUniqueOrThrow({ where: { email: invitedEmail } })
    invitedId = invited.id
    const membership = await database.organizationMember.findUniqueOrThrow({
      where: { organizationId_userId: { organizationId, userId: invited.id } },
    })

    const forbiddenUpdate = await request(
      'PATCH',
      `/api/v1/organizations/${organizationId}`,
      { name: 'Member cannot update' },
      invitedJar,
    )
    expect(forbiddenUpdate.statusCode).toBe(403)

    const changed = await request(
      'PATCH',
      `/api/v1/organizations/${organizationId}/members/${membership.id}/role`,
      { role: 'VIEWER' },
      ownerJar,
    )
    expect(changed.statusCode, changed.body).toBe(200)
    const revoked = await request('GET', '/api/v1/me', undefined, invitedJar)
    expect(revoked.statusCode).toBe(401)

    const viewerLogin = await request(
      'POST',
      '/api/v1/auth/login',
      { email: invitedEmail, password },
      invitedJar,
    )
    expect(viewerLogin.statusCode).toBe(200)
    const forbiddenViewerAction = await request(
      'POST',
      `/api/v1/organizations/${organizationId}/invitations`,
      { email: `forbidden-${marker}@example.test`, role: 'MEMBER' },
      invitedJar,
    )
    expect(forbiddenViewerAction.statusCode).toBe(403)

    const removed = await request(
      'DELETE',
      `/api/v1/organizations/${organizationId}/members/${membership.id}`,
      undefined,
      ownerJar,
    )
    expect(removed.statusCode, removed.body).toBe(200)
    expect((await request('GET', '/api/v1/me', undefined, invitedJar)).statusCode).toBe(401)
    const relogin = await request(
      'POST',
      '/api/v1/auth/login',
      { email: invitedEmail, password },
      invitedJar,
    )
    expect(relogin.statusCode).toBe(200)
    expect(
      (await request('GET', `/api/v1/organizations/${organizationId}`, undefined, invitedJar))
        .statusCode,
    ).toBe(404)
  })

  it('revokes previous sessions after password reset and records sensitive audit events', async () => {
    const resetToken = `password-reset-${marker}-abcdefghijklmnopqrstuvwxyz`
    const oldJar = new CookieJar()
    const oldLogin = await request(
      'POST',
      '/api/v1/auth/login',
      { email: invitedEmail, password },
      oldJar,
    )
    expect(oldLogin.statusCode).toBe(200)
    await database.passwordResetToken.create({
      data: {
        userId: invitedId,
        tokenHash: hashToken(resetToken),
        expiresAt: new Date(Date.now() + 60_000),
      },
    })
    const resetJar = new CookieJar()
    const reset = await request(
      'POST',
      '/api/v1/auth/reset-password',
      { token: resetToken, password: nextPassword },
      resetJar,
    )
    expect(reset.statusCode, reset.body).toBe(200)
    expect((await request('GET', '/api/v1/me', undefined, oldJar)).statusCode).toBe(401)
    expect((await request('GET', '/api/v1/me', undefined, resetJar)).statusCode).toBe(200)
    const listed = await request('GET', '/api/v1/auth/sessions', undefined, resetJar)
    expect(listed.statusCode, listed.body).toBe(200)
    expect((listed.json() as { sessions: { current: boolean }[] }).sessions).toEqual(
      expect.arrayContaining([expect.objectContaining({ current: true })]),
    )
    const logoutAll = await request('POST', '/api/v1/auth/logout-all', undefined, resetJar)
    expect(logoutAll.statusCode, logoutAll.body).toBe(200)
    expect((await request('GET', '/api/v1/me', undefined, resetJar)).statusCode).toBe(401)
    const events = await database.auditLog.findMany({
      where: { actorUserId: { in: [ownerId, invitedId] } },
      select: { action: true },
    })
    expect(events.map((event) => event.action)).toEqual(
      expect.arrayContaining([
        'auth.registration',
        'auth.email_verification',
        'auth.login_success',
        'organization.created',
        'organization.invitation_accepted',
        'organization.member_role_changed',
        'auth.password_reset_complete',
      ]),
    )
  })
})
