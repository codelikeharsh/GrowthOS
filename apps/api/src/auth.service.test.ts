import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthService } from './auth.service.js'
import { setApiEnvironmentForTest } from './environment.js'
import { EmailDeliveryError } from './mail.service.js'

describe('registration email recovery', () => {
  afterEach(() => {
    setApiEnvironmentForTest(undefined)
  })

  it('keeps a pending account recoverable when verification delivery fails', async () => {
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
      EMAIL_DELIVERY_TIMEOUT_MS: 100,
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_test_key',
      SMTP_HOST: 'localhost',
      SMTP_PORT: 1025,
      SMTP_SECURE: false,
      SMTP_USER: undefined,
      SMTP_PASSWORD: undefined,
      MAIL_FROM: 'no-reply@example.test',
      OPENAPI_ENABLED: false,
    })
    const mail = {
      sendEmailVerification: vi.fn().mockRejectedValue(new EmailDeliveryError('timeout')),
    }
    const audit = { record: vi.fn().mockResolvedValue(undefined) }
    const service = new AuthService({} as never, mail as never, {} as never, audit as never)
    const create = vi.fn().mockResolvedValue({ id: 'user-1' })
    Object.defineProperty(service, 'database', {
      value: { user: { findUnique: vi.fn().mockResolvedValue(null), create } },
    })

    await expect(
      service.register('recover@example.test', 'Recover User', 'StrongPassword!42', {
        ipAddress: '127.0.0.1',
        requestId: 'request-1',
        userAgent: undefined,
      }),
    ).resolves.toMatchObject({
      verificationEmailSent: false,
      message: expect.stringContaining('resend'),
    })
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'recover@example.test',
          emailVerificationTokens: expect.any(Object),
        }),
      }),
    )
    expect(mail.sendEmailVerification).toHaveBeenCalledOnce()
  })
})
