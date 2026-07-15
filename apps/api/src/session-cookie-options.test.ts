import { describe, expect, it } from 'vitest'
import { csrfCookieOptions, sessionCookieOptions } from './session-cookie-options.js'

const session = {
  id: 'session-id',
  rawSessionToken: 'opaque-session',
  rawCsrfToken: 'csrf-token',
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
}

const productionEnvironment = {
  NODE_ENV: 'production' as const,
  COOKIE_DOMAIN: 'zero2one.live',
}

describe('shared authentication cookie options', () => {
  it('sets secure shared-domain cookies for app.zero2one.live and api.zero2one.live', () => {
    expect(sessionCookieOptions(productionEnvironment as never, session)).toMatchObject({
      domain: 'zero2one.live',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
    })
    expect(csrfCookieOptions(productionEnvironment as never, session)).toMatchObject({
      domain: 'zero2one.live',
      path: '/',
      secure: true,
      httpOnly: false,
      sameSite: 'lax',
    })
  })

  it('preserves host-only localhost cookies when no COOKIE_DOMAIN is configured', () => {
    const options = sessionCookieOptions({ NODE_ENV: 'development' } as never, session)
    expect(options).not.toHaveProperty('domain')
    expect(options).toMatchObject({ path: '/', secure: false, httpOnly: true })
  })
})
