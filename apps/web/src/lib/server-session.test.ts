import { beforeEach, describe, expect, it, vi } from 'vitest'

const getCookie = vi.fn()
const redirect = vi.fn((location: string) => {
  throw new Error(`redirect:${location}`)
})

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: getCookie }),
}))
vi.mock('next/navigation', () => ({ redirect }))

const { requireServerSession } = await import('./server-session.js')

describe('server-side shared-domain session guard', () => {
  beforeEach(() => {
    getCookie.mockReset()
    redirect.mockClear()
    vi.unstubAllGlobals()
    process.env.SESSION_COOKIE_NAME = 'growthos_session'
    process.env.NEXT_PUBLIC_API_URL = 'https://api.zero2one.live/api/v1'
  })

  it('forwards only the opaque session cookie to the configured API /me endpoint', async () => {
    getCookie.mockReturnValue({ value: 'opaque-session-token' })
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'user-id', email: 'user@example.test', displayName: 'User' }),
    })
    vi.stubGlobal('fetch', fetch)
    await expect(requireServerSession()).resolves.toMatchObject({ id: 'user-id' })
    expect(fetch).toHaveBeenCalledWith(
      'https://api.zero2one.live/api/v1/me',
      expect.objectContaining({
        cache: 'no-store',
        headers: { cookie: 'growthos_session=opaque-session-token' },
      }),
    )
  })

  it('fails closed when the shared-domain cookie is absent', async () => {
    getCookie.mockReturnValue(undefined)
    await expect(requireServerSession()).rejects.toThrow('redirect:/login')
    expect(redirect).toHaveBeenCalledWith('/login')
  })
})
