'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { apiBaseUrl, apiRequest } from '../lib/api'
import type { WebsiteContext } from './website-manager'

interface Audit {
  id: string
  status: string
  triggerType: string
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  failedAt: string | null
  failureMessage: string | null
  pagesDiscovered: number
  pagesProcessed: number
}

export function AuditHistory({
  context,
  websiteId,
}: {
  context: WebsiteContext
  websiteId: string
}) {
  const [audits, setAudits] = useState<Audit[]>([])
  const [error, setError] = useState('')
  const base = `${context.detailBase}/${websiteId}/audits`
  async function load(): Promise<void> {
    try {
      setAudits(
        (
          await apiRequest<{ audits: Audit[] }>(`/websites/${websiteId}/audits`, {
            headers: context.headers,
          })
        ).audits,
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load audits')
    }
  }
  useEffect(() => {
    const controller = new AbortController()
    apiRequest<{ audits: Audit[] }>(`/websites/${websiteId}/audits`, {
      headers: context.headers,
      signal: controller.signal,
    })
      .then(({ audits: result }) => setAudits(result))
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : 'Unable to load audits')
      })
    return () => controller.abort()
  }, [context.headers, websiteId])
  async function start(): Promise<void> {
    try {
      await apiRequest(`/websites/${websiteId}/audits`, {
        method: 'POST',
        headers: { ...context.headers, 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({}),
      })
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to request audit')
    }
  }
  async function cancel(auditId: string): Promise<void> {
    try {
      await apiRequest(`/websites/${websiteId}/audits/${auditId}`, {
        method: 'DELETE',
        headers: context.headers,
      })
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to cancel audit')
    }
  }
  return (
    <section className="ui-card mt-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Audit history</h2>
        <button className="ui-button" onClick={() => void start()} type="button">
          Start audit
        </button>
      </div>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Each audit uses the registered website and follows the existing secure, bounded crawl
        policy.
      </p>
      {error ? (
        <p className="mt-3 text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="mt-4 divide-y divide-[var(--line)]">
        {audits.map((audit) => (
          <li className="flex flex-wrap items-center gap-3 py-3" key={audit.id}>
            <span className="mr-auto">
              <strong>{audit.status}</strong>
              <span className="block text-sm text-[var(--muted)]">
                {audit.triggerType} · {new Date(audit.createdAt).toLocaleString()}
              </span>
            </span>
            <Link className="ui-button-secondary" href={`${base}/${audit.id}`}>
              Details
            </Link>
            {audit.status === 'QUEUED' ? (
              <button
                className="rounded-md border border-red-300 px-3 py-2 text-red-800"
                onClick={() => void cancel(audit.id)}
                type="button"
              >
                Cancel
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

export function AuditStatus({
  context,
  websiteId,
  auditId,
  listHref,
}: {
  context: WebsiteContext
  websiteId: string
  auditId: string
  listHref: string
}) {
  const [audit, setAudit] = useState<Audit>()
  const [error, setError] = useState('')
  const [findings, setFindings] = useState<
    {
      id: string
      title: string
      severity: string
      category: string
      description: string
      recommendationTemplate: string
      auditPage?: { normalizedUrl: string } | null
    }[]
  >([])
  const [pages, setPages] = useState<
    {
      id: string
      normalizedUrl: string
      status: string
      httpStatus?: number | null
      errorCode?: string | null
    }[]
  >([])
  const [severity, setSeverity] = useState('')
  const [category, setCategory] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    const terminal = new Set(['COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED'])
    let fallback: ReturnType<typeof setInterval> | undefined
    const refresh = (): void => {
      void apiRequest<Audit>(`/websites/${websiteId}/audits/${auditId}`, {
        headers: context.headers,
      })
        .then(setAudit)
        .catch(() => undefined)
    }
    const stream = async (): Promise<void> => {
      try {
        const response = await fetch(
          `${apiBaseUrl}/websites/${websiteId}/audits/${auditId}/events`,
          { headers: context.headers, credentials: 'include', signal: controller.signal },
        )
        if (!response.ok || !response.body) throw new Error('SSE unavailable')
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (!controller.signal.aborted) {
          const next = await reader.read()
          if (next.done) break
          buffer += decoder.decode(next.value, { stream: true })
          const events = buffer.split('\n\n')
          buffer = events.pop() ?? ''
          for (const event of events) {
            const data = event
              .split('\n')
              .find((line) => line.startsWith('data: '))
              ?.slice(6)
            if (!data) continue
            const progress = JSON.parse(data) as Pick<
              Audit,
              'status' | 'pagesDiscovered' | 'pagesProcessed'
            >
            setAudit((current) => (current ? { ...current, ...progress } : current))
            if (terminal.has(progress.status)) {
              controller.abort()
              return
            }
          }
        }
        if (!controller.signal.aborted) fallback = setInterval(refresh, 5_000)
      } catch {
        if (!controller.signal.aborted) fallback = setInterval(refresh, 5_000)
      }
    }
    void stream()
    apiRequest<Audit>(`/websites/${websiteId}/audits/${auditId}`, { headers: context.headers })
      .then(setAudit)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Unable to load audit'),
      )
    apiRequest<typeof findings>(`/websites/${websiteId}/audits/${auditId}/findings`, {
      headers: context.headers,
    })
      .then(setFindings)
      .catch(() => setFindings([]))
    apiRequest<{ pages: typeof pages }>(`/websites/${websiteId}/audits/${auditId}/report`, {
      headers: context.headers,
    })
      .then((report) => setPages(report.pages))
      .catch(() => setPages([]))
    return () => {
      controller.abort()
      if (fallback) clearInterval(fallback)
    }
  }, [auditId, websiteId, context.headers])
  if (error)
    return (
      <p role="alert" className="text-red-800">
        {error}
      </p>
    )
  if (!audit) return <p>Loading audit…</p>
  return (
    <section className="ui-card max-w-4xl p-6 sm:p-8">
      <Link className="font-semibold text-[var(--accent)]" href={listHref}>
        ← Website
      </Link>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">Audit report</h2>
        <span
          className={`ui-badge ${audit.status === 'COMPLETED' ? 'ui-badge-success' : audit.status === 'PARTIAL' ? 'ui-badge-warning' : audit.status === 'FAILED' ? 'ui-badge-error' : ''}`}
        >
          {audit.status}
        </span>
      </div>
      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="font-semibold">Requested</dt>
          <dd>{new Date(audit.createdAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt className="font-semibold">Trigger</dt>
          <dd>{audit.triggerType}</dd>
        </div>
        <div>
          <dt className="font-semibold">Pages</dt>
          <dd>
            {audit.pagesProcessed} processed / {audit.pagesDiscovered} discovered
          </dd>
        </div>
        {audit.failureMessage ? (
          <div>
            <dt className="font-semibold">Failure</dt>
            <dd>{audit.failureMessage}</dd>
          </div>
        ) : null}
      </dl>
      <h3 className="mt-8 text-lg font-semibold">Findings</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        <select
          aria-label="Severity"
          value={severity}
          onChange={(event) => setSeverity(event.target.value)}
        >
          <option value="">All severities</option>
          {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <select
          aria-label="Category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="">All categories</option>
          {['TECHNICAL', 'SEO', 'CONTENT', 'BROKEN_LINK'].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </div>
      {findings.length ? (
        <ul className="mt-3 space-y-3">
          {findings
            .filter(
              (finding) =>
                (!severity || finding.severity === severity) &&
                (!category || finding.category === category),
            )
            .map((finding) => (
              <li
                className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-raised)] p-4 text-sm"
                key={finding.id}
              >
                <strong>
                  {finding.severity} · {finding.category}: {finding.title}
                </strong>
                <p>{finding.auditPage?.normalizedUrl ?? 'Audit-wide'}</p>
                <p>{finding.description}</p>
                <p className="mt-1">
                  <span className="font-semibold">Suggested action:</span>{' '}
                  {finding.recommendationTemplate}
                </p>
              </li>
            ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm">No deterministic findings recorded.</p>
      )}
      <h3 className="mt-6 text-lg font-semibold">Crawled pages</h3>
      {pages.length ? (
        <ul className="mt-2 space-y-2 text-sm">
          {pages.map((page) => (
            <li
              className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-raised)] p-3"
              key={page.id}
            >
              <strong>{page.status}</strong> · {page.normalizedUrl}
              {page.httpStatus ? ` (${page.httpStatus})` : ''}
              {page.errorCode ? ` — ${page.errorCode}` : ''}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm">No crawled pages recorded.</p>
      )}
    </section>
  )
}
