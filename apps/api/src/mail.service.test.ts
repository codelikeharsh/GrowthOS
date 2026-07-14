import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setApiEnvironmentForTest } from './environment.js'
import { MailService, type EmailDeliveryError } from './mail.service.js'

function resendEnvironment(timeout = 1_000) {
  return {
    NODE_ENV: 'test' as const,
    LOG_LEVEL: 'silent' as const,
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
    EMAIL_DELIVERY_TIMEOUT_MS: timeout,
    EMAIL_PROVIDER: 'resend' as const,
    RESEND_API_KEY: 're_test_key',
    SMTP_HOST: 'localhost',
    SMTP_PORT: 1025,
    SMTP_SECURE: false,
    SMTP_USER: undefined,
    SMTP_PASSWORD: undefined,
    MAIL_FROM: 'no-reply@example.test',
    OPENAPI_ENABLED: false,
  }
}

describe('Resend mail transport', () => {
  beforeEach(() => {
    setApiEnvironmentForTest(resendEnvironment())
  })
  afterEach(() => {
    setApiEnvironmentForTest(undefined)
    vi.unstubAllGlobals()
  })

  it('sends a verification email through the authenticated HTTPS API', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'email_1' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await new MailService().sendEmailVerification('person@example.test', 'safe-token')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authorization: 'Bearer re_test_key' }),
      }),
    )
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1].body as string) as { html: string }
    expect(body.html).toContain('/verify-email?token=safe-token')
  })

  it('returns a safe delivery error when Resend rejects the request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('provider detail', { status: 503 })),
    )

    await expect(
      new MailService().sendEmailVerification('person@example.test', 'safe-token'),
    ).rejects.toEqual(expect.objectContaining<Partial<EmailDeliveryError>>({ reason: 'failed' }))
  })

  it('enforces the configured HTTPS delivery timeout', async () => {
    setApiEnvironmentForTest(resendEnvironment(100))
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, options: RequestInit) =>
          new Promise((_, reject) =>
            options.signal?.addEventListener('abort', () => {
              reject(
                options.signal?.reason instanceof Error
                  ? options.signal.reason
                  : new Error('Aborted'),
              )
            }),
          ),
      ),
    )

    await expect(
      new MailService().sendEmailVerification('person@example.test', 'safe-token'),
    ).rejects.toEqual(expect.objectContaining<Partial<EmailDeliveryError>>({ reason: 'timeout' }))
  })
})
