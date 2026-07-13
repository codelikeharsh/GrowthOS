import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import {
  AgencyClientRelationshipStatus,
  getDatabaseClient,
  OrganizationType,
  RoleName,
  UserStatus,
} from '@growthos/db'
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

describe.sequential('Phase 4A website registration integration', () => {
  const database = getDatabaseClient()
  const marker = `${String(Date.now())}-${Math.random().toString(16).slice(2)}`
  const password = 'StrongPassword!42'
  const agencyEmail = `phase4a-agency-${marker}@example.test`
  const businessEmail = `phase4a-business-${marker}@example.test`
  const outsiderEmail = `phase4a-outsider-${marker}@example.test`
  const agencyJar = new CookieJar()
  const businessJar = new CookieJar()
  const outsiderJar = new CookieJar()
  let app: NestFastifyApplication
  let agencyId = ''
  let businessId = ''
  let unrelatedBusinessId = ''
  let relationshipId = ''
  let websiteId = ''

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
      MAILPIT_SMTP_HOST: 'localhost',
      MAILPIT_SMTP_PORT: 1025,
      MAIL_FROM: 'no-reply@growthos.local',
      OPENAPI_ENABLED: false,
    })
    app = await createApplication(AppModule)
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
    const ownerRole = await database.role.findUniqueOrThrow({ where: { name: RoleName.OWNER } })
    const [agencyUser, businessUser] = await Promise.all([
      createUser(agencyEmail),
      createUser(businessEmail),
      createUser(outsiderEmail),
    ])
    const agency = await database.organization.create({
      data: {
        name: `Phase 4A Agency ${marker}`,
        slug: `phase4a-agency-${marker}`,
        type: OrganizationType.AGENCY,
        memberships: { create: { userId: agencyUser.id, roleId: ownerRole.id } },
      },
    })
    const business = await database.organization.create({
      data: {
        name: `Phase 4A Business ${marker}`,
        slug: `phase4a-business-${marker}`,
        type: OrganizationType.BUSINESS,
        memberships: { create: { userId: businessUser.id, roleId: ownerRole.id } },
      },
    })
    const unrelated = await database.organization.create({
      data: {
        name: `Phase 4A Unrelated ${marker}`,
        slug: `phase4a-unrelated-${marker}`,
        type: OrganizationType.BUSINESS,
      },
    })
    agencyId = agency.id
    businessId = business.id
    unrelatedBusinessId = unrelated.id
    const relationship = await database.agencyClientRelationship.create({
      data: {
        agencyOrganizationId: agencyId,
        businessOrganizationId: businessId,
        status: AgencyClientRelationshipStatus.ACTIVE,
        createdByUserId: agencyUser.id,
      },
    })
    relationshipId = relationship.id
    await Promise.all([
      login(agencyEmail, agencyJar),
      login(businessEmail, businessJar),
      login(outsiderEmail, outsiderJar),
    ])
  })

  afterAll(async () => {
    await database.auditLog.deleteMany({
      where: { organizationId: { in: [agencyId, businessId, unrelatedBusinessId] } },
    })
    await database.website.deleteMany({
      where: { businessOrganizationId: { in: [businessId, unrelatedBusinessId] } },
    })
    await database.agencyClientRelationship.deleteMany({ where: { id: relationshipId } })
    await database.organizationMember.deleteMany({
      where: { organizationId: { in: [agencyId, businessId, unrelatedBusinessId] } },
    })
    await database.organization.deleteMany({
      where: { id: { in: [agencyId, businessId, unrelatedBusinessId] } },
    })
    await database.user.deleteMany({
      where: { email: { in: [agencyEmail, businessEmail, outsiderEmail] } },
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
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    body?: object,
    jar?: CookieJar,
    headers: Record<string, string> = {},
  ): Promise<TestResponse> {
    const response = await app.inject({
      method,
      url,
      ...(body ? { payload: body } : {}),
      headers: {
        ...headers,
        ...(jar?.header() ? { cookie: jar.header() } : {}),
        ...(jar && method !== 'GET' ? { 'x-csrf-token': jar.csrf() } : {}),
      },
    })
    const typed = response as unknown as TestResponse
    jar?.update(typed)
    return typed
  }

  it('registers, lists, views, updates, normalizes, and disables a website through an agency relationship', async () => {
    const headers = { 'x-agency-organization-id': agencyId, 'x-relationship-id': relationshipId }
    const created = await request(
      'POST',
      '/api/v1/websites',
      { displayName: 'Primary site', url: 'HTTPS://Example.COM:443/#overview' },
      agencyJar,
      headers,
    )
    expect(created.statusCode, created.body).toBe(201)
    const website = created.json() as { id: string; normalizedUrl: string; version: number }
    websiteId = website.id
    expect(website.normalizedUrl).toBe('https://example.com/')
    const list = await request('GET', '/api/v1/websites', undefined, agencyJar, headers)
    expect(list.statusCode).toBe(200)
    expect((list.json() as { id: string }[]).map((item) => item.id)).toContain(websiteId)
    expect(
      (
        await request(
          'POST',
          '/api/v1/websites',
          { url: 'https://example.com/' },
          agencyJar,
          headers,
        )
      ).statusCode,
    ).toBe(409)
    const updated = await request(
      'PATCH',
      `/api/v1/websites/${websiteId}`,
      {
        displayName: 'Renamed site',
        url: 'https://example.com/path#ignored',
        version: website.version,
      },
      agencyJar,
      headers,
    )
    expect(updated.statusCode, updated.body).toBe(200)
    expect((updated.json() as { normalizedUrl: string }).normalizedUrl).toBe(
      'https://example.com/path',
    )
    const stale = await request(
      'PATCH',
      `/api/v1/websites/${websiteId}`,
      { displayName: 'Stale write', version: website.version },
      agencyJar,
      headers,
    )
    expect(stale.statusCode).toBe(409)
    expect(stale.body).toContain('OPTIMISTIC_CONCURRENCY_CONFLICT')
    expect(
      (await request('DELETE', `/api/v1/websites/${websiteId}`, undefined, agencyJar, headers))
        .statusCode,
    ).toBe(200)
    expect(
      (await request('GET', `/api/v1/websites/${websiteId}`, undefined, agencyJar, headers)).body,
    ).toContain('"isActive":false')
    expect(
      await database.auditLog.count({ where: { action: { startsWith: 'website.' } } }),
    ).toBeGreaterThanOrEqual(3)
  })

  it('allows the business owner but blocks outsiders and unrelated relationship access', async () => {
    const businessHeaders = { 'x-organization-id': businessId }
    const created = await request(
      'POST',
      '/api/v1/websites',
      { url: 'https://business.example.test', displayName: 'Business site' },
      businessJar,
      businessHeaders,
    )
    expect(created.statusCode, created.body).toBe(201)
    const unrelatedWebsite = await database.website.create({
      data: {
        businessOrganizationId: unrelatedBusinessId,
        url: 'https://unrelated.example.test/',
        normalizedUrl: 'https://unrelated.example.test/',
      },
    })
    const agencyHeaders = {
      'x-agency-organization-id': agencyId,
      'x-relationship-id': relationshipId,
    }
    const crossTenant = await request(
      'GET',
      `/api/v1/websites/${unrelatedWebsite.id}`,
      undefined,
      agencyJar,
      agencyHeaders,
    )
    expect(crossTenant.statusCode).toBe(404)
    const outsider = await request(
      'GET',
      '/api/v1/websites',
      undefined,
      outsiderJar,
      businessHeaders,
    )
    expect(outsider.statusCode).toBe(404)
    const invalidUrl = await request(
      'POST',
      '/api/v1/websites',
      { url: 'javascript:alert(1)' },
      businessJar,
      businessHeaders,
    )
    expect(invalidUrl.statusCode).toBe(400)
    expect(invalidUrl.body).toContain('INVALID_WEBSITE_URL')
  })
})
