export const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  const prefix = `${encodeURIComponent(name)}=`
  return document.cookie
    .split('; ')
    .find((item) => item.startsWith(prefix))
    ?.slice(prefix.length)
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = init.method?.toUpperCase() ?? 'GET'
  const csrf = !['GET', 'HEAD', 'OPTIONS'].includes(method) ? getCookie('growthos_csrf') : undefined
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(csrf ? { 'x-csrf-token': decodeURIComponent(csrf) } : {}),
      ...init.headers,
    },
  })
  const payload = (await response.json().catch(() => ({}))) as { message?: string }
  if (!response.ok) throw new Error(payload.message ?? `Request failed (${response.status})`)
  return payload as T
}
