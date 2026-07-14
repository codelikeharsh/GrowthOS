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
import { WebsiteService } from './website.service.js'

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

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('getResponse' in error)) return undefined
  const response = (error as { getResponse(): unknown }).getResponse()
  return typeof response === 'object' && response !== null && 'code' in response
    ? String(response.code)
    : undefined
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
  let businessWebsiteId = ''

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
      EMAIL_VERIFICATION_RESEND_RATE_LIMIT: 3,
      EMAIL_DELIVERY_TIMEOUT_MS: 1_000,
      EMAIL_PROVIDER: 'smtp',
      RESEND_API_KEY: undefined,
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
    await database.outboxEvent.deleteMany({
      where: { organizationId: { in: [agencyId, businessId, unrelatedBusinessId] } },
    })
    await database.auditRun.deleteMany({
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
      { url: 'https://8.8.8.8', displayName: 'Business site' },
      businessJar,
      businessHeaders,
    )
    expect(created.statusCode, created.body).toBe(201)
    businessWebsiteId = (created.json() as { id: string }).id
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

  it('prepares authorized website targets without external DNS and keeps private or cross-tenant targets blocked', async () => {
    const websites = app.get(WebsiteService)
    await expect(
      websites.prepareOutboundTarget(
        (await database.user.findUniqueOrThrow({ where: { email: businessEmail } })).id,
        { businessId },
        businessWebsiteId,
      ),
    ).resolves.toMatchObject({ current: { connections: [{ address: '8.8.8.8', port: 443 }] } })
    const privateWebsite = await database.website.create({
      data: {
        businessOrganizationId: businessId,
        url: 'http://127.0.0.1/',
        normalizedUrl: 'http://127.0.0.1/',
      },
    })
    await expect(
      websites.prepareOutboundTarget(
        (await database.user.findUniqueOrThrow({ where: { email: businessEmail } })).id,
        { businessId },
        privateWebsite.id,
      ),
    ).rejects.toSatisfy((error: unknown) => errorCode(error) === 'WEBSITE_TARGET_IP_FORBIDDEN')
    await expect(
      websites.prepareOutboundTarget(
        (await database.user.findUniqueOrThrow({ where: { email: outsiderEmail } })).id,
        { businessId },
        businessWebsiteId,
      ),
    ).rejects.toSatisfy(
      (error: unknown) => error instanceof Error && error.message === 'Organization not found',
    )
  })

  it('creates, dispatches, lists, authorizes, and cancels queued audits without crawling', async () => {
    const businessHeaders = {
      'x-organization-id': businessId,
      'idempotency-key': `audit-${marker}`,
    }
    const created = await request(
      'POST',
      `/api/v1/websites/${businessWebsiteId}/audits`,
      {},
      businessJar,
      businessHeaders,
    )
    expect(created.statusCode, created.body).toBe(201)
    const audit = created.json() as { id: string; status: string }
    expect(audit.status).toBe('QUEUED')
    expect(
      (
        await request(
          'POST',
          `/api/v1/websites/${businessWebsiteId}/audits`,
          {},
          businessJar,
          businessHeaders,
        )
      ).body,
    ).toContain(audit.id)
    expect(
      (
        await request('POST', `/api/v1/websites/${businessWebsiteId}/audits`, {}, businessJar, {
          ...businessHeaders,
          'idempotency-key': `other-${marker}`,
        })
      ).statusCode,
    ).toBe(409)
    expect(
      await database.outboxEvent.count({
        where: { auditRunId: audit.id, processedAt: { not: null } },
      }),
    ).toBe(1)
    expect(
      (
        await request(
          'GET',
          `/api/v1/websites/${businessWebsiteId}/audits`,
          undefined,
          businessJar,
          businessHeaders,
        )
      ).body,
    ).toContain(audit.id)
    const agencyHeaders = {
      'x-agency-organization-id': agencyId,
      'x-relationship-id': relationshipId,
    }
    const page = await database.auditPage.create({
      data: {
        auditRunId: audit.id,
        url: 'https://example.com/',
        normalizedUrl: 'https://example.com/',
        status: 'FETCHED',
      },
    })
    await database.auditFinding.createMany({
      data: [
        {
          auditRunId: audit.id,
          auditPageId: page.id,
          category: 'SEO',
          ruleId: 'SEO_TITLE_MISSING',
          severity: 'MEDIUM',
          title: 'Missing title',
          description: 'No title.',
          evidence: { pageUrl: page.normalizedUrl },
          recommendationTemplate: 'Add a title.',
          fingerprint: `finding-a-${marker}`,
        },
        {
          auditRunId: audit.id,
          category: 'CONTENT',
          ruleId: 'CONTENT_THIN',
          severity: 'LOW',
          title: 'Thin content',
          description: 'Low word count.',
          evidence: {},
          recommendationTemplate: 'Add content.',
          fingerprint: `finding-b-${marker}`,
        },
      ],
    })
    const findingsPath = `/api/v1/websites/${businessWebsiteId}/audits/${audit.id}/findings`
    expect(
      (await request('GET', findingsPath, undefined, businessJar, businessHeaders)).statusCode,
    ).toBe(200)
    expect(
      (
        await request(
          'GET',
          `${findingsPath}?severity=MEDIUM`,
          undefined,
          businessJar,
          businessHeaders,
        )
      ).body,
    ).toContain('SEO_TITLE_MISSING')
    expect(
      (
        await request(
          'GET',
          `${findingsPath}?category=CONTENT`,
          undefined,
          businessJar,
          businessHeaders,
        )
      ).body,
    ).toContain('CONTENT_THIN')
    expect(
      (
        await request(
          'GET',
          `${findingsPath}?ruleId=SEO_TITLE_MISSING&pageId=${page.id}&limit=1`,
          undefined,
          agencyJar,
          agencyHeaders,
        )
      ).body,
    ).toContain('Missing title')
    expect(
      (
        await request(
          'GET',
          `/api/v1/websites/${businessWebsiteId}/audits/${audit.id}`,
          undefined,
          agencyJar,
          agencyHeaders,
        )
      ).statusCode,
    ).toBe(200)
    expect(
      (
        await request(
          'GET',
          `/api/v1/websites/${businessWebsiteId}/audits/${audit.id}`,
          undefined,
          outsiderJar,
          businessHeaders,
        )
      ).statusCode,
    ).toBe(404)
    const viewerRole = await database.role.findUniqueOrThrow({ where: { name: RoleName.VIEWER } })
    const outsider = await database.user.findUniqueOrThrow({ where: { email: outsiderEmail } })
    await database.organizationMember.create({
      data: { organizationId: businessId, userId: outsider.id, roleId: viewerRole.id },
    })
    expect(
      (
        await request('POST', `/api/v1/websites/${businessWebsiteId}/audits`, {}, outsiderJar, {
          'x-organization-id': businessId,
          'idempotency-key': `viewer-${marker}`,
        })
      ).statusCode,
    ).toBe(403)
    expect(
      (
        await request(
          'DELETE',
          `/api/v1/websites/${businessWebsiteId}/audits/${audit.id}`,
          undefined,
          businessJar,
          businessHeaders,
        )
      ).statusCode,
    ).toBe(200)
    expect(
      (
        await request(
          'DELETE',
          `/api/v1/websites/${businessWebsiteId}/audits/${audit.id}`,
          undefined,
          businessJar,
          businessHeaders,
        )
      ).statusCode,
    ).toBe(409)
    expect(
      (
        await request('POST', `/api/v1/websites/${websiteId}/audits`, {}, businessJar, {
          'x-organization-id': businessId,
          'idempotency-key': `disabled-${marker}`,
        })
      ).statusCode,
    ).toBe(409)
  })
})
