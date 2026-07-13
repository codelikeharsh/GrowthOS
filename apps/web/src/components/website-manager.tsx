'use client'

import Link from 'next/link'
import { type FormEvent, useEffect, useState } from 'react'
import { apiRequest } from '../lib/api'

export interface WebsiteContext {
  headers: Record<string, string>
  detailBase: string
}
interface Website {
  id: string
  displayName: string | null
  url: string
  normalizedUrl: string
  isActive: boolean
  version: number
  createdAt: string
}

export function WebsiteList({ context }: { context: WebsiteContext }) {
  const [websites, setWebsites] = useState<Website[]>([])
  const [displayName, setDisplayName] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function load(): Promise<void> {
    try {
      setWebsites(await apiRequest<Website[]>('/websites', { headers: context.headers }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load websites')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<Website[]>('/websites', { headers: context.headers, signal: controller.signal })
      .then(setWebsites)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : 'Unable to load websites')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [context.headers])

  async function register(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError('')
    try {
      await apiRequest('/websites', {
        method: 'POST',
        headers: context.headers,
        body: JSON.stringify({ url, ...(displayName.trim() ? { displayName } : {}) }),
      })
      setDisplayName('')
      setUrl('')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to register website')
    }
  }

  return (
    <div className="space-y-6">
      <form
        className="max-w-2xl rounded-xl border border-[var(--line)] bg-white p-6"
        onSubmit={register}
      >
        <h2 className="text-xl font-semibold">Register website</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          This stores website metadata only. It does not fetch, crawl, or assess the URL.
        </p>
        <label className="mt-5 block font-medium">
          Website URL
          <input
            className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] px-3"
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com"
            required
            type="url"
            value={url}
          />
        </label>
        <label className="mt-4 block font-medium">
          Display name <span className="font-normal text-[var(--muted)]">(optional)</span>
          <input
            className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] px-3"
            onChange={(event) => setDisplayName(event.target.value)}
            value={displayName}
          />
        </label>
        <button
          className="mt-5 min-h-11 rounded-md bg-[var(--accent)] px-4 font-semibold text-white"
          type="submit"
        >
          Register website
        </button>
      </form>
      {error ? (
        <p className="text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      <section className="rounded-xl border border-[var(--line)] bg-white p-6">
        <h2 className="text-xl font-semibold">Registered websites</h2>
        {loading ? <p className="mt-4">Loading websites…</p> : null}
        {!loading && websites.length === 0 ? (
          <p className="mt-4 text-[var(--muted)]">No websites are registered.</p>
        ) : null}
        <ul className="mt-4 divide-y divide-[var(--line)]">
          {websites.map((website) => (
            <li className="flex flex-wrap items-center gap-3 py-4" key={website.id}>
              <span className="mr-auto">
                <strong>{website.displayName ?? website.normalizedUrl}</strong>
                <span className="block text-sm text-[var(--muted)]">{website.normalizedUrl}</span>
              </span>
              <span className="text-sm text-[var(--muted)]">
                {website.isActive ? 'Active' : 'Disabled'}
              </span>
              <Link
                className="rounded-md border px-3 py-2"
                href={`${context.detailBase}/${website.id}`}
              >
                View details
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

export function WebsiteDetail({
  context,
  websiteId,
  listHref,
}: {
  context: WebsiteContext
  websiteId: string
  listHref: string
}) {
  const [website, setWebsite] = useState<Website>()
  const [displayName, setDisplayName] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  async function load(): Promise<void> {
    try {
      const result = await apiRequest<Website>(`/websites/${websiteId}`, {
        headers: context.headers,
      })
      setWebsite(result)
      setDisplayName(result.displayName ?? '')
      setUrl(result.url)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load website')
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<Website>(`/websites/${websiteId}`, {
      headers: context.headers,
      signal: controller.signal,
    })
      .then((result) => {
        setWebsite(result)
        setDisplayName(result.displayName ?? '')
        setUrl(result.url)
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : 'Unable to load website')
      })
    return () => controller.abort()
  }, [context.headers, websiteId])

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!website) return
    setError('')
    try {
      await apiRequest(`/websites/${websiteId}`, {
        method: 'PATCH',
        headers: context.headers,
        body: JSON.stringify({ displayName, url, version: website.version }),
      })
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update website')
    }
  }

  async function disable(): Promise<void> {
    try {
      await apiRequest(`/websites/${websiteId}`, { method: 'DELETE', headers: context.headers })
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to disable website')
    }
  }

  if (error && !website)
    return (
      <p className="text-red-800" role="alert">
        {error}
      </p>
    )
  if (!website) return <p>Loading website…</p>
  return (
    <div className="space-y-5">
      <Link className="font-semibold text-[var(--accent)]" href={listHref}>
        ← Websites
      </Link>
      <form
        className="max-w-2xl rounded-xl border border-[var(--line)] bg-white p-6"
        onSubmit={save}
      >
        <h2 className="text-xl font-semibold">Website details</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {website.isActive ? 'Active' : 'Disabled'}
        </p>
        <label className="mt-5 block font-medium">
          Website URL
          <input
            className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] px-3"
            onChange={(event) => setUrl(event.target.value)}
            required
            type="url"
            value={url}
          />
        </label>
        <label className="mt-4 block font-medium">
          Display name
          <input
            className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] px-3"
            onChange={(event) => setDisplayName(event.target.value)}
            value={displayName}
          />
        </label>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            className="min-h-11 rounded-md bg-[var(--accent)] px-4 font-semibold text-white"
            disabled={!website.isActive}
            type="submit"
          >
            Save changes
          </button>
          {website.isActive ? (
            <button
              className="min-h-11 rounded-md border border-red-300 px-4 text-red-800"
              onClick={() => void disable()}
              type="button"
            >
              Disable website
            </button>
          ) : null}
        </div>
        {error ? (
          <p className="mt-4 text-red-800" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  )
}
