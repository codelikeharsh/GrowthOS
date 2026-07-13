import { expect, test, type APIRequestContext } from '@playwright/test'

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
  if (!link) throw new Error(`Mailpit message ${id} did not contain a web link`)
  return link
}

test('Phase 3 agency-client onboarding and collaboration journey', async ({
  browser,
  page,
  request,
}) => {
  const marker = `${String(Date.now())}-${Math.random().toString(16).slice(2)}`
  const agencyEmail = `phase3-agency-${marker}@example.test`
  const clientEmail = `phase3-client-${marker}@example.test`
  const password = 'BrowserPassword!42'
  const agencyName = `Phase 3 Agency ${marker}`
  const legalName = `Phase 3 Legal ${marker}`
  const tradeName = `Phase 3 Trade ${marker}`

  await page.goto('/register')
  await page.getByLabel('Name').fill('Phase Three Agency Owner')
  await page.getByLabel('Email').fill(agencyEmail)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Register' }).click()
  await expect(page.getByRole('status')).toContainText('Check your email')
  await page.goto(await latestMailLink(request, agencyEmail, 'Verify your Growth OS email'))
  await page.getByRole('button', { name: 'Verify email' }).click()
  await page.goto('/login')
  await page.getByLabel('Email').fill(agencyEmail)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByLabel('Name').fill(agencyName)
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByText(agencyName)).toBeVisible()

  await page.goto('/app/clients/new')
  await page.getByLabel('Legal name').fill(legalName)
  await page.getByLabel('Trade name').fill(tradeName)
  await page.getByLabel('Service plan').fill('Growth partnership')
  await page.getByRole('button', { name: 'Create client' }).click()
  await expect(page).toHaveURL(/\/app\/clients\/[0-9a-f-]+$/)
  const relationshipUrl = page.url()
  await expect(page.getByRole('heading', { name: tradeName })).toBeVisible()

  await page.getByLabel('Client record').getByRole('link', { name: 'Profile' }).click()
  await page.getByLabel('Short description').fill('A real browser-validated business profile')
  await page.getByRole('button', { name: 'Save profile' }).click()
  await expect(page.getByRole('button', { name: 'Save profile' })).toBeEnabled()

  await page.goto(`${relationshipUrl}/locations`)
  await page.getByLabel('Name').fill('Head office')
  await page.getByLabel('Type').selectOption('HEADQUARTERS')
  await page.getByText('Primary active location').click()
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('status')).toContainText('Saved')

  await page.goto(`${relationshipUrl}/hours`)
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('status')).toContainText('Saved')

  await page.goto(`${relationshipUrl}/services`)
  await page.getByLabel('Service').fill('Growth strategy')
  await page.getByLabel('Price type').selectOption('QUOTE_REQUIRED')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('status')).toContainText('Saved')

  await page.goto(`${relationshipUrl}/social-links`)
  await page.getByLabel('Platform').selectOption('INSTAGRAM')
  await page.getByLabel('URL').fill('https://instagram.com/example')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('status')).toContainText('Saved')

  await page.goto(`${relationshipUrl}/notes`)
  await page.getByLabel('Visibility').selectOption('AGENCY_INTERNAL')
  await page.getByLabel('Note').fill('Agency-only planning note')
  await page.getByRole('button', { name: 'Add note' }).click()
  await expect(page.getByText('Agency-only planning note')).toBeVisible()

  await page.goto(relationshipUrl)
  await page.getByLabel('Owner email').fill(clientEmail)
  await page.getByRole('button', { name: 'Invite owner' }).click()
  await expect(page.getByText(clientEmail, { exact: true })).toBeVisible()
  const invitationLink = await latestMailLink(
    request,
    clientEmail,
    `Join ${tradeName} in Growth OS`,
  )

  const clientContext = await browser.newContext()
  const clientPage = await clientContext.newPage()
  await clientPage.goto(invitationLink)
  await clientPage.getByLabel('Name (new accounts)').fill('Phase Three Client Owner')
  await clientPage.getByLabel('Password (new accounts)').fill(password)
  await clientPage.getByRole('button', { name: 'Accept invitation' }).click()
  await expect(clientPage.getByRole('status')).toContainText('Invitation accepted')
  await clientPage.getByRole('link', { name: 'Open workspace' }).click()
  await clientPage.goto('/app/business/profile')
  await expect(clientPage.getByLabel('Legal name')).toHaveValue(legalName)
  await clientPage.getByLabel('Short description').fill('Updated safely by the client owner')
  await clientPage.getByRole('button', { name: 'Save profile' }).click()
  await clientPage.goto('/app/business/relationship')
  await expect(clientPage.getByText('Agency-only planning note')).toHaveCount(0)
  await clientPage.getByLabel('Note').fill('Client-visible browser reply')
  await clientPage.getByRole('button', { name: 'Add note' }).click()
  await expect(clientPage.getByText('Client-visible browser reply')).toBeVisible()

  await page.goto(`${relationshipUrl}/notes`)
  await expect(page.getByText('Client-visible browser reply')).toBeVisible()
  await page.goto('/app/clients')
  await expect(page.getByRole('link', { name: tradeName })).toBeVisible()
  await clientContext.close()
})
