import { expect, test, type APIRequestContext } from '@playwright/test'

interface MailpitMessageSummary {
  ID: string
  To: { Address: string }[]
  Subject: string
}

async function latestMailLink(
  request: APIRequestContext,
  email: string,
  subject: string,
): Promise<string> {
  let messageId = ''
  await expect
    .poll(
      async () => {
        const response = await request.get('http://localhost:8025/api/v1/messages')
        const payload = (await response.json()) as { messages: MailpitMessageSummary[] }
        messageId =
          payload.messages.find(
            (message) =>
              message.Subject === subject &&
              message.To.some((recipient) => recipient.Address === email),
          )?.ID ?? ''
        return messageId
      },
      { timeout: 15_000 },
    )
    .not.toBe('')
  const response = await request.get(`http://localhost:8025/api/v1/message/${messageId}`)
  const payload = (await response.json()) as { Text: string }
  const link = payload.Text.match(/http:\/\/localhost:3000\/[^\s]+/)?.[0]
  if (!link) throw new Error(`Mailpit message ${messageId} did not contain a web link`)
  return link
}

test('registration, verification, organization and invitation flow works in a browser', async ({
  browser,
  page,
  request,
}) => {
  const marker = `${String(Date.now())}-${Math.random().toString(16).slice(2)}`
  const ownerEmail = `browser-owner-${marker}@example.test`
  const memberEmail = `browser-member-${marker}@example.test`
  const password = 'BrowserPassword!42'
  const organizationName = `Browser Agency ${marker}`

  await page.goto('/register')
  await page.getByLabel('Name').fill('Browser Owner')
  await page.getByLabel('Email').fill(ownerEmail)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Register' }).click()
  await expect(page.getByRole('status')).toContainText('Check your email')

  await page.goto(await latestMailLink(request, ownerEmail, 'Verify your Growth OS email'))
  await page.getByRole('button', { name: 'Verify email' }).click()
  await expect(page.getByRole('status')).toContainText('Email verified')

  await page.goto('/login')
  await page.getByLabel('Email').fill(ownerEmail)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/app$/)
  await page.getByLabel('Name').fill(organizationName)
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByText(organizationName)).toBeVisible()

  await page.goto('/app/settings/members')
  await page.getByLabel('Email').fill(memberEmail)
  await page.getByRole('button', { name: 'Send invitation' }).click()
  await expect(page.getByRole('status')).toContainText('Invitation sent')

  const invitationLink = await latestMailLink(
    request,
    memberEmail,
    `Join ${organizationName} in Growth OS`,
  )
  const memberContext = await browser.newContext()
  const memberPage = await memberContext.newPage()
  await memberPage.goto(invitationLink)
  await memberPage.getByLabel('Name (new accounts)').fill('Browser Member')
  await memberPage.getByLabel('Password (new accounts)').fill(password)
  await memberPage.getByRole('button', { name: 'Accept invitation' }).click()
  await expect(memberPage.getByRole('status')).toContainText('Invitation accepted')
  await memberPage.getByRole('link', { name: 'Open workspace' }).click()
  await expect(memberPage.getByRole('heading', { name: 'Workspace', exact: true })).toBeVisible()
  await memberContext.close()

  await page.reload()
  await expect(page.getByText(memberEmail)).toBeVisible()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login$/)
})
