import { afterEach, describe, expect, it } from 'vitest'
import { setApiEnvironmentForTest } from './environment.js'
import { MailService } from './mail.service.js'

const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true'

describe.skipIf(!runIntegration)('Mailpit SMTP integration', () => {
  afterEach(() => {
    setApiEnvironmentForTest(undefined)
  })

  it('delivers a verification message to local Mailpit', async () => {
    setApiEnvironmentForTest({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      API_PORT: 3001,
      API_CORS_ORIGINS: ['http://localhost:3000'],
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/test',
      REDIS_URL: 'redis://localhost:6379',
      PUBLIC_WEB_URL: 'http://localhost:3000',
      SESSION_COOKIE_NAME: 'growthos_session',
      CSRF_COOKIE_NAME: 'growthos_csrf',
      SESSION_TTL_HOURS: 168,
      EMAIL_VERIFICATION_TTL_MINUTES: 60,
      PASSWORD_RESET_TTL_MINUTES: 30,
      INVITATION_TTL_HOURS: 72,
      LOGIN_RATE_LIMIT: 5,
      PASSWORD_RESET_RATE_LIMIT: 5,
      AUTH_RATE_LIMIT_WINDOW_SECONDS: 900,
      EMAIL_VERIFICATION_RESEND_RATE_LIMIT: 3,
      EMAIL_DELIVERY_TIMEOUT_MS: 1_000,
      EMAIL_PROVIDER: 'smtp',
      RESEND_API_KEY: undefined,
      SMTP_HOST: process.env.SMTP_HOST ?? 'localhost',
      SMTP_PORT: Number(process.env.SMTP_PORT ?? 1025),
      SMTP_SECURE: false,
      SMTP_USER: undefined,
      SMTP_PASSWORD: undefined,
      MAIL_FROM: 'no-reply@growthos.local',
      OPENAPI_ENABLED: false,
    })
    await expect(
      new MailService().sendEmailVerification('mailpit-validation@example.test', 'mailpit-token'),
    ).resolves.toBeUndefined()
  })
})
