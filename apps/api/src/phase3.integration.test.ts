import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { getDatabaseClient, OrganizationType, RoleName, UserStatus } from '@growthos/db'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppModule } from './app.module.js'
import { createApplication } from './app.js'
import { setApiEnvironmentForTest } from './environment.js'
import { hashPassword } from './security.js'

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

describe.sequential('Phase 3 agency-client integration', () => {
  const database = getDatabaseClient()
  const marker = `${String(Date.now())}-${Math.random().toString(16).slice(2)}`
  const password = 'StrongPassword!42'
  const agencyOwnerEmail = `phase3-owner-${marker}@example.test`
  const clientOwnerEmail = `phase3-client-${marker}@example.test`
  const outsiderEmail = `phase3-outsider-${marker}@example.test`
  let app: NestFastifyApplication
  let ownerId = ''
  let clientOwnerId = ''
  let agencyId = ''
  let businessId = ''
  let relationshipId = ''
  const ownerJar = new CookieJar()
  const clientJar = new CookieJar()
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
      LOGIN_RATE_LIMIT: 100,
      PASSWORD_RESET_RATE_LIMIT: 100,
      AUTH_RATE_LIMIT_WINDOW_SECONDS: 60,
      SMTP_HOST: 'localhost',
      SMTP_PORT: 1025,
      SMTP_SECURE: false,
      MAIL_FROM: 'no-reply@growthos.local',
      OPENAPI_ENABLED: false,
    })
    app = await createApplication(AppModule)
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
    const ownerRole = await database.role.findUniqueOrThrow({ where: { name: RoleName.OWNER } })
    const [owner, clientOwner] = await Promise.all([
      createUser(agencyOwnerEmail),
      createUser(clientOwnerEmail),
      createUser(outsiderEmail),
    ])
    ownerId = owner.id
    clientOwnerId = clientOwner.id
    const agency = await database.organization.create({
      data: {
        name: `Phase 3 Agency ${marker}`,
        slug: `phase3-agency-${marker}`,
        type: OrganizationType.AGENCY,
        memberships: { create: { userId: owner.id, roleId: ownerRole.id } },
      },
    })
    agencyId = agency.id
    await login(agencyOwnerEmail, ownerJar)
    await login(clientOwnerEmail, clientJar)
    await login(outsiderEmail, outsiderJar)
  })

  afterAll(async () => {
    if (businessId) {
      await database.auditLog.deleteMany({
        where: { organizationId: { in: [agencyId, businessId] } },
      })
      await database.agencyClientNote.deleteMany({
        where: { relationship: { businessOrganizationId: businessId } },
      })
      await database.organizationInvitation.deleteMany({ where: { organizationId: businessId } })
      await database.organizationMember.deleteMany({ where: { organizationId: businessId } })
      await database.businessHour.deleteMany({ where: { businessOrganizationId: businessId } })
      await database.businessSocialLink.deleteMany({
        where: { businessOrganizationId: businessId },
      })
      await database.businessService.deleteMany({ where: { businessOrganizationId: businessId } })
      await database.businessLocation.deleteMany({ where: { businessOrganizationId: businessId } })
      await database.businessProfile.deleteMany({ where: { organizationId: businessId } })
      await database.agencyClientRelationship.deleteMany({
        where: { businessOrganizationId: businessId },
      })
      await database.organization.deleteMany({ where: { id: businessId } })
    }
    if (agencyId) {
      await database.auditLog.deleteMany({ where: { organizationId: agencyId } })
      await database.organizationMember.deleteMany({ where: { organizationId: agencyId } })
      await database.organization.deleteMany({ where: { id: agencyId } })
    }
    await database.user.deleteMany({
      where: { email: { in: [agencyOwnerEmail, clientOwnerEmail, outsiderEmail] } },
    })
    await app.close()
    setApiEnvironmentForTest(undefined)
  })

  async function createUser(email: string) {
    return database.user.create({
      data: {
        email,
        displayName: email.split('@')[0] ?? 'User',
        passwordHash: await hashPassword(password),
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    })
  }
  async function login(email: string, jar: CookieJar): Promise<void> {
    const response = await request('POST', '/api/v1/auth/login', { email, password }, jar)
    expect(response.statusCode, response.body).toBe(200)
  }
  async function request(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    url: string,
    body?: object,
    jar?: CookieJar,
    organizationHeaders: Record<string, string> = {},
  ): Promise<TestResponse> {
    const response = await app.inject({
      method,
      url,
      ...(body ? { payload: body } : {}),
      headers: {
        ...organizationHeaders,
        ...(jar?.header() ? { cookie: jar.header() } : {}),
        ...(jar && method !== 'GET' ? { 'x-csrf-token': jar.csrf() } : {}),
      },
    })
    const typed = response as unknown as TestResponse
    jar?.update(typed)
    return typed
  }

  it('creates the client atomically and enforces idempotency, constraints, and bounded listing', async () => {
    const headers = { 'x-organization-id': agencyId, 'idempotency-key': `phase3-${marker}` }
    const created = await request(
      'POST',
      '/api/v1/agency-clients',
      {
        legalName: `Client Legal ${marker}`,
        tradeName: `Client Trade ${marker}`,
        status: 'ACTIVE',
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        countryCode: 'IN',
      },
      ownerJar,
      headers,
    )
    expect(created.statusCode, created.body).toBe(201)
    const payload = created.json() as {
      id: string
      businessOrganizationId: string
      version: number
    }
    relationshipId = payload.id
    businessId = payload.businessOrganizationId
    const repeated = await request(
      'POST',
      '/api/v1/agency-clients',
      { legalName: 'Ignored duplicate', status: 'ACTIVE' },
      ownerJar,
      headers,
    )
    expect(repeated.statusCode).toBe(201)
    expect((repeated.json() as { id: string }).id).toBe(relationshipId)
    expect(await database.businessProfile.count({ where: { organizationId: businessId } })).toBe(1)
    const list = await request(
      'GET',
      '/api/v1/agency-clients?status=ACTIVE&limit=1',
      undefined,
      ownerJar,
      { 'x-organization-id': agencyId },
    )
    expect(list.statusCode, list.body).toBe(200)
    expect((list.json() as { clients: { id: string }[] }).clients.map((item) => item.id)).toContain(
      relationshipId,
    )
    const otherAgency = await database.organization.create({
      data: {
        name: 'Constraint test',
        slug: `constraint-${marker}`,
        type: OrganizationType.AGENCY,
      },
    })
    await expect(
      database.agencyClientRelationship.create({
        data: {
          agencyOrganizationId: otherAgency.id,
          businessOrganizationId: businessId,
          status: 'ACTIVE',
          createdByUserId: ownerId,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' })
    await database.organization.delete({ where: { id: otherAgency.id } })
  })

  it('manages profile resources, rejects overlaps, and detects stale writes', async () => {
    const headers = { 'x-agency-organization-id': agencyId, 'x-relationship-id': relationshipId }
    const profile = await request('GET', '/api/v1/business-profile', undefined, ownerJar, headers)
    const version = (profile.json() as { version: number }).version
    expect(
      (
        await request(
          'PATCH',
          '/api/v1/business-profile',
          { version, shortDescription: 'Real client profile' },
          ownerJar,
          headers,
        )
      ).statusCode,
    ).toBe(200)
    const stale = await request(
      'PATCH',
      '/api/v1/business-profile',
      { version, shortDescription: 'Stale' },
      ownerJar,
      headers,
    )
    expect(stale.statusCode).toBe(409)
    expect(stale.body).toContain('OPTIMISTIC_CONCURRENCY_CONFLICT')
    expect(
      (
        await request(
          'POST',
          '/api/v1/business-profile/locations',
          { name: 'Head office', locationType: 'HEADQUARTERS', countryCode: 'IN', isPrimary: true },
          ownerJar,
          headers,
        )
      ).statusCode,
    ).toBe(201)
    expect(
      (
        await request(
          'POST',
          '/api/v1/business-profile/services',
          { name: 'Growth strategy', priceType: 'QUOTE_REQUIRED', currency: 'INR' },
          ownerJar,
          headers,
        )
      ).statusCode,
    ).toBe(201)
    const hours = [
      {
        dayOfWeek: 'MONDAY',
        opensAtMinutes: 540,
        closesAtMinutes: 720,
        isClosed: false,
        displayOrder: 0,
      },
      {
        dayOfWeek: 'MONDAY',
        opensAtMinutes: 660,
        closesAtMinutes: 780,
        isClosed: false,
        displayOrder: 1,
      },
    ]
    const overlap = await request(
      'PUT',
      '/api/v1/business-profile/hours',
      { hours },
      ownerJar,
      headers,
    )
    expect(overlap.statusCode).toBe(409)
    expect(overlap.body).toContain('BUSINESS_HOURS_OVERLAP')
    expect(
      (
        await request(
          'PUT',
          '/api/v1/business-profile/hours',
          { hours: [hours[0]] },
          ownerJar,
          headers,
        )
      ).statusCode,
    ).toBe(200)
    expect(
      (
        await request(
          'POST',
          '/api/v1/business-profile/social-links',
          { platform: 'INSTAGRAM', url: 'https://instagram.com/example' },
          ownerJar,
          headers,
        )
      ).statusCode,
    ).toBe(201)
  })

  it('reuses invitations, filters internal notes, and isolates business tenants', async () => {
    const agencyHeaders = { 'x-organization-id': agencyId }
    const invited = await request(
      'POST',
      `/api/v1/agency-clients/${relationshipId}/invitations`,
      { email: clientOwnerEmail },
      ownerJar,
      agencyHeaders,
    )
    expect(invited.statusCode, invited.body).toBe(201)
    const ownerRole = await database.role.findUniqueOrThrow({ where: { name: RoleName.OWNER } })
    await database.organizationMember.create({
      data: {
        organizationId: businessId,
        userId: clientOwnerId,
        roleId: ownerRole.id,
        invitedById: ownerId,
      },
    })
    expect(
      (
        await request(
          'POST',
          `/api/v1/agency-clients/${relationshipId}/notes`,
          { visibility: 'AGENCY_INTERNAL', body: 'Internal only' },
          ownerJar,
          agencyHeaders,
        )
      ).statusCode,
    ).toBe(201)
    expect(
      (
        await request(
          'POST',
          `/api/v1/agency-clients/${relationshipId}/notes`,
          { visibility: 'CLIENT_VISIBLE', body: 'Shared note' },
          ownerJar,
          agencyHeaders,
        )
      ).statusCode,
    ).toBe(201)
    const agencyNotes = await request(
      'GET',
      `/api/v1/agency-clients/${relationshipId}/notes`,
      undefined,
      ownerJar,
      agencyHeaders,
    )
    expect(agencyNotes.statusCode, agencyNotes.body).toBe(200)
    expect(agencyNotes.body).toContain('Internal only')
    const businessNotes = await request(
      'GET',
      '/api/v1/business-profile/relationship/notes',
      undefined,
      clientJar,
      { 'x-organization-id': businessId },
    )
    expect(businessNotes.statusCode, businessNotes.body).toBe(200)
    expect(businessNotes.body).toContain('Shared note')
    expect(businessNotes.body).not.toContain('Internal only')
    expect(
      (
        await request(
          'POST',
          '/api/v1/business-profile/relationship/notes',
          { visibility: 'CLIENT_VISIBLE', body: 'Client reply' },
          clientJar,
          { 'x-organization-id': businessId },
        )
      ).statusCode,
    ).toBe(201)
    const outsider = await request('GET', '/api/v1/business-profile', undefined, outsiderJar, {
      'x-organization-id': businessId,
    })
    expect(outsider.statusCode).toBe(404)
    expect(outsider.body).not.toContain(`Client Legal ${marker}`)
    expect(
      await database.auditLog.count({
        where: {
          action: { startsWith: 'business_' },
          organizationId: { in: [agencyId, businessId] },
        },
      }),
    ).toBeGreaterThan(3)
  })
})
