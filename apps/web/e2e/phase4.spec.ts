import { expect, test, type APIRequestContext } from '@playwright/test'
import { AuditOrchestrationConsumer } from '../../worker/src/audit-orchestration.js'
import type {
  HomepageResponse,
  SecurePageFetcher,
} from '../../worker/src/secure-homepage-fetcher.js'

interface MailSummary {
  ID: string
  To: { Address: string }[]
  Subject: string
}

async function latestMailLink(
  request: APIRequestContext,
  email: string,
  subject: string,
): Promise<string> {
  let id = ''
  await expect
    .poll(
      async () => {
        const response = await request.get('http://localhost:8025/api/v1/messages')
        const payload = (await response.json()) as { messages: MailSummary[] }
        id =
          payload.messages.find(
            (message) =>
              message.Subject === subject &&
              message.To.some((recipient) => recipient.Address === email),
          )?.ID ?? ''
        return id
      },
      { timeout: 15_000 },
    )
    .not.toBe('')
  const payload = (await (
    await request.get(`http://localhost:8025/api/v1/message/${id}`)
  ).json()) as { Text: string }
  const link = payload.Text.match(/http:\/\/localhost:3000\/[^\s]+/)?.[0]
  if (!link) throw new Error('Expected local verification or invitation link')
  return link
}

function fixtureResponse(url: string, body: string, contentType = 'text/html'): HomepageResponse {
  return {
    finalUrl: url,
    httpStatus: 200,
    contentType,
    body: Buffer.from(body),
    durationMs: 1,
    connection: {
      address: '93.184.216.34',
      family: 4,
      port: 443,
      hostHeader: 'phase4-fixture.example.test',
    },
  }
}

test('Phase 4 deterministic audit journey renders a tenant-isolated report', async ({
  browser,
  page,
  request,
}) => {
  const marker = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const password = 'BrowserPassword!42'
  const agencyEmail = `phase4-agency-${marker}@example.test`
  const businessEmail = `phase4-business-${marker}@example.test`
  const outsiderEmail = `phase4-outsider-${marker}@example.test`
  const agencyName = `Phase 4 Agency ${marker}`
  const businessName = `Phase 4 Business ${marker}`

  await page.goto('/register')
  await page.getByLabel('Name').fill('Phase Four Agency Owner')
  await page.getByLabel('Email').fill(agencyEmail)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Register' }).click()
  await page.goto(await latestMailLink(request, agencyEmail, 'Verify your Growth OS email'))
  await page.getByRole('button', { name: 'Verify email' }).click()
  await page.goto('/login')
  await page.getByLabel('Email').fill(agencyEmail)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByLabel('Name').fill(agencyName)
  await page.getByRole('button', { name: 'Create' }).click()

  await page.goto('/app/clients/new')
  await page.getByLabel('Legal name').fill(businessName)
  await page.getByLabel('Trade name').fill(businessName)
  await page.getByLabel('Service plan').fill('Phase 4 deterministic validation')
  await page.getByLabel('Client owner email').fill(businessEmail)
  await page.getByRole('button', { name: 'Create client' }).click()
  const relationshipUrl = page.url()
  await expect(page.getByRole('heading', { name: businessName })).toBeVisible()

  const businessContext = await browser.newContext()
  const businessPage = await businessContext.newPage()
  await businessPage.goto(
    await latestMailLink(request, businessEmail, `Join ${businessName} in Growth OS`),
  )
  await businessPage.getByLabel('Name (new accounts)').fill('Phase Four Business Owner')
  await businessPage.getByLabel('Password (new accounts)').fill(password)
  await businessPage.getByRole('button', { name: 'Accept invitation' }).click()
  await businessPage.getByRole('link', { name: 'Open workspace' }).click()
  await businessPage.goto('/app/business/websites')
  await businessPage.getByLabel('Website URL').fill('https://phase4-fixture.example.test/')
  await businessPage.getByLabel('Display name').fill('Phase 4 fixture')
  await businessPage.getByRole('button', { name: 'Register website' }).click()
  await businessPage.getByRole('link', { name: 'View details' }).click()
  await businessPage.getByRole('button', { name: 'Start audit' }).click()
  const details = businessPage.getByRole('link', { name: 'Details' })
  await expect(details).toHaveCount(1)
  const detailHref = await details.getAttribute('href')
  if (!detailHref) throw new Error('Expected audit details link')
  const parts = detailHref.split('/')
  const auditId = parts.at(-1)
  const websiteId = parts.at(-3)
  if (!websiteId || !auditId) throw new Error('Expected stable website and audit identifiers')

  const fetcher: SecurePageFetcher = {
    fetch: async (url) => {
      if (url.endsWith('/robots.txt')) return fixtureResponse(url, 'User-agent: *\nAllow: /')
      if (url.endsWith('/sitemap.xml')) return fixtureResponse(url, '', 'application/xml')
      if (url.endsWith('/about'))
        return fixtureResponse(url, '<html><body><p>About fixture page</p></body></html>')
      return fixtureResponse(
        url,
        '<html><body><a href="/about">About</a><p>Short fixture page</p></body></html>',
      )
    },
  }
  const worker = new AuditOrchestrationConsumer(fetcher, {
    info: () => undefined,
    error: () => undefined,
  })
  const business = (await businessPage.evaluate(async () =>
    fetch('http://localhost:3001/api/v1/organizations', { credentials: 'include' }).then(
      (response) => response.json(),
    ),
  )) as { organizations: { id: string; type: string }[] }
  const organizationId = business.organizations.find(
    (organization) => organization.type === 'BUSINESS',
  )?.id
  if (!organizationId) throw new Error('Expected business organization')
  await worker.process({ auditRunId: auditId, websiteId, organizationId }, 'phase4-fixture-job')

  await businessPage.goto(detailHref)
  await expect(
    businessPage.getByRole('heading', { name: /Audit status: (COMPLETED|PARTIAL)/ }),
  ).toBeVisible()
  await expect(businessPage.getByRole('heading', { name: 'Crawled pages' })).toBeVisible()
  await expect(
    businessPage.getByText('FETCHED · https://phase4-fixture.example.test/ (200)'),
  ).toBeVisible()
  await expect(businessPage.getByRole('heading', { name: 'Findings' })).toBeVisible()

  const outsider = await browser.newContext()
  const outsiderPage = await outsider.newPage()
  await outsiderPage.goto('/register')
  await outsiderPage.getByLabel('Name').fill('Phase Four Outsider')
  await outsiderPage.getByLabel('Email').fill(outsiderEmail)
  await outsiderPage.getByLabel('Password').fill(password)
  await outsiderPage.getByRole('button', { name: 'Register' }).click()
  await outsiderPage.goto(
    await latestMailLink(request, outsiderEmail, 'Verify your Growth OS email'),
  )
  await outsiderPage.getByRole('button', { name: 'Verify email' }).click()
  await outsiderPage.goto('/login')
  await outsiderPage.getByLabel('Email').fill(outsiderEmail)
  await outsiderPage.getByLabel('Password').fill(password)
  await outsiderPage.getByRole('button', { name: 'Sign in' }).click()
  await outsiderPage.getByLabel('Name').fill(`Outsider ${marker}`)
  await outsiderPage.getByRole('button', { name: 'Create' }).click()
  const denial = await outsiderPage.evaluate(
    async ({ websiteId, auditId, organizationId }) => {
      const base = `http://localhost:3001/api/v1/websites/${websiteId}/audits/${auditId}`
      const headers = { 'x-organization-id': organizationId }
      const [report, progress] = await Promise.all([
        fetch(`${base}/report`, { credentials: 'include', headers }),
        fetch(`${base}/events`, { credentials: 'include', headers }),
      ])
      return [report.status, progress.status]
    },
    { websiteId, auditId, organizationId },
  )
  expect(denial).toEqual([404, 404])
  await outsider.close()
  await businessContext.close()
  expect(relationshipUrl).toContain('/app/clients/')
})
