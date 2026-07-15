import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

interface CurrentUser {
  id: string
  email: string
  displayName: string
}

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'
}

/**
 * A server-rendered /app guard. When COOKIE_DOMAIN is configured on the API,
 * the browser also supplies the opaque session cookie to app.zero2one.live.
 * Forward only that cookie to api.zero2one.live; never put a token in a URL or
 * expose it to client JavaScript.
 */
export async function requireServerSession(): Promise<CurrentUser> {
  const sessionCookieName = process.env.SESSION_COOKIE_NAME ?? 'growthos_session'
  const session = (await cookies()).get(sessionCookieName)
  if (!session) redirect('/login')
  let response: Response
  try {
    response = await fetch(`${apiBaseUrl()}/me`, {
      headers: { cookie: `${sessionCookieName}=${encodeURIComponent(session.value)}` },
      cache: 'no-store',
    })
  } catch {
    redirect('/login')
  }
  if (!response.ok) redirect('/login')
  try {
    return (await response.json()) as CurrentUser
  } catch {
    redirect('/login')
  }
}
