import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthController } from './auth.controller.js'
import { setApiEnvironmentForTest } from './environment.js'

const environment = {
  NODE_ENV: 'production' as const,
  LOG_LEVEL: 'silent' as const,
  API_PORT: 3001,
  API_CORS_ORIGINS: ['https://app.zero2one.live'],
  DATABASE_URL: 'postgresql://user:pass@postgres.internal:5432/db',
  REDIS_URL: 'redis://redis.internal:6379',
  PUBLIC_WEB_URL: 'https://app.zero2one.live',
  SESSION_COOKIE_NAME: 'growthos_session',
  CSRF_COOKIE_NAME: 'growthos_csrf',
  COOKIE_DOMAIN: 'zero2one.live',
  SESSION_TTL_HOURS: 168,
  EMAIL_VERIFICATION_TTL_MINUTES: 60,
  PASSWORD_RESET_TTL_MINUTES: 30,
  INVITATION_TTL_HOURS: 72,
  LOGIN_RATE_LIMIT: 5,
  PASSWORD_RESET_RATE_LIMIT: 5,
  AUTH_RATE_LIMIT_WINDOW_SECONDS: 900,
  EMAIL_VERIFICATION_RESEND_RATE_LIMIT: 3,
  EMAIL_DELIVERY_TIMEOUT_MS: 1_000,
  EMAIL_PROVIDER: 'resend' as const,
  RESEND_API_KEY: 're_test_key',
  SMTP_HOST: 'localhost',
  SMTP_PORT: 1025,
  SMTP_SECURE: false,
  SMTP_USER: undefined,
  SMTP_PASSWORD: undefined,
  MAIL_FROM: 'no-reply@zero2one.live',
  OPENAPI_ENABLED: false,
}

describe('production authentication cookies', () => {
  afterEach(() => {
    setApiEnvironmentForTest(undefined)
  })

  it('creates and clears matching shared-domain session and CSRF cookies', () => {
    setApiEnvironmentForTest(environment)
    const reply = { setCookie: vi.fn(), clearCookie: vi.fn() }
    const controller = new AuthController({} as never, {} as never, {} as never)
    const session = {
      id: 'session-id',
      rawSessionToken: 'opaque-token',
      rawCsrfToken: 'csrf-token',
      expiresAt: new Date(Date.now() + 60_000),
    }
    controller.setSessionCookies(reply as never, session)
    expect(reply.setCookie).toHaveBeenNthCalledWith(
      1,
      'growthos_session',
      'opaque-token',
      expect.objectContaining({
        domain: 'zero2one.live',
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'lax',
      }),
    )
    expect(reply.setCookie).toHaveBeenNthCalledWith(
      2,
      'growthos_csrf',
      'csrf-token',
      expect.objectContaining({ domain: 'zero2one.live', secure: true, httpOnly: false }),
    )
    controller.clearSessionCookies(reply as never)
    expect(reply.clearCookie).toHaveBeenCalledWith(
      'growthos_session',
      expect.objectContaining({ domain: 'zero2one.live', path: '/', secure: true }),
    )
  })
})
