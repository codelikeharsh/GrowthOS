import type { ApiEnvironment } from '@growthos/config'
import type { CookieSerializeOptions } from '@fastify/cookie'
import type { CreatedSession } from './session.service.js'

/** Cookie attributes shared by sign-in, password-reset, and invitation flows.
 * COOKIE_DOMAIN deliberately remains unset locally so localhost keeps host-only
 * cookies. Production must set a reviewed parent domain such as zero2one.live. */
export function sessionCookieOptions(
  environment: ApiEnvironment,
  session: CreatedSession,
): CookieSerializeOptions {
  const maxAge = Math.max(0, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000))
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: environment.NODE_ENV === 'production',
    path: '/',
    maxAge,
    ...(environment.COOKIE_DOMAIN ? { domain: environment.COOKIE_DOMAIN } : {}),
  }
}

export function csrfCookieOptions(
  environment: ApiEnvironment,
  session: CreatedSession,
): CookieSerializeOptions {
  return { ...sessionCookieOptions(environment, session), httpOnly: false }
}

export function clearCookieOptions(environment: ApiEnvironment): CookieSerializeOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: environment.NODE_ENV === 'production',
    path: '/',
    ...(environment.COOKIE_DOMAIN ? { domain: environment.COOKIE_DOMAIN } : {}),
  }
}
