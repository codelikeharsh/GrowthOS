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
  linksChecked?: number
  progressStage?: string | null
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
      metrics?: {
        htmlBytes: number
        responseTimeMs?: number | null
        resourceCount: number
        imageCount: number
      } | null
      structuredData?: { id: string; status: string; types: string[] }[]
    }[]
  >([])
  const [severity, setSeverity] = useState('')
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [scores, setScores] = useState<
    { category: string; score: number; findingCount: number; methodologyVersion: string }[]
  >([])
  const [comparison, setComparison] = useState<{
    overallScoreChange?: number | null
    newFindings: number
    resolvedFindings: number
    unchangedFindings: number
  } | null>(null)
  const [links, setLinks] = useState<
    {
      id: string
      destinationUrl: string
      kind: string
      status: string
      httpStatus?: number | null
      redirectUrl?: string | null
      sourceAuditPage?: { normalizedUrl: string } | null
    }[]
  >([])
  useEffect(() => {
    const controller = new AbortController()
    const terminal = new Set(['COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED'])
    let fallback: ReturnType<typeof setInterval> | undefined
    const refresh = (): void => {
      void apiRequest<Audit>(`/websites/${websiteId}/audits/${auditId}`, {
        headers: context.headers,
      })
        .then((next) => {
          setAudit(next)
          if (terminal.has(next.status)) loadReport()
        })
        .catch(() => undefined)
    }
    const loadReport = (): void => {
      void apiRequest<typeof findings>(`/websites/${websiteId}/audits/${auditId}/findings`, {
        headers: context.headers,
      })
        .then(setFindings)
        .catch(() => setFindings([]))
      void apiRequest<{
        pages: typeof pages
        categoryScores: typeof scores
        comparison: typeof comparison
        links: typeof links
        providerExecutions: { provider: string; status: string; metrics: Record<string, unknown> }[]
      }>(`/websites/${websiteId}/audits/${auditId}/report`, {
        headers: context.headers,
      })
        .then((report) => {
          setPages(report.pages)
          setScores(report.categoryScores)
          setComparison(report.comparison)
          setLinks(report.links)
        })
        .catch(() => setPages([]))
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
              'status' | 'progressStage' | 'pagesDiscovered' | 'pagesProcessed' | 'linksChecked'
            >
            setAudit((current) => (current ? { ...current, ...progress } : current))
            if (terminal.has(progress.status)) {
              loadReport()
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
    loadReport()
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
          <dt className="font-semibold">Live stage</dt>
          <dd>{audit.progressStage?.replaceAll('_', ' ') ?? 'Awaiting audit work'}</dd>
        </div>
        <div>
          <dt className="font-semibold">Links checked</dt>
          <dd>{audit.linksChecked ?? 0}</dd>
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
      <section className="mt-7">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-lg font-semibold">Audit health</h3>
          <p className="text-xs text-[var(--muted)]">
            Transparent deterministic scoring · {scores[0]?.methodologyVersion ?? 'pending'}
          </p>
        </div>
        {scores.length ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {scores.map((score) => (
              <div className="ui-panel p-4" key={score.category}>
                <p className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
                  {score.category.replaceAll('_', ' ')}
                </p>
                <p className="mt-2 text-3xl font-semibold">{score.score}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {score.findingCount} observed issue{score.findingCount === 1 ? '' : 's'}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="ui-empty mt-3 text-sm">
            Scores appear after deterministic analysis finishes.
          </p>
        )}
        {comparison ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            Compared with the previous compatible audit: {comparison.newFindings} new,{' '}
            {comparison.resolvedFindings} resolved, and {comparison.unchangedFindings} unchanged
            {comparison.overallScoreChange == null
              ? '.'
              : ` · overall score ${comparison.overallScoreChange >= 0 ? '+' : ''}${comparison.overallScoreChange}.`}
          </p>
        ) : null}
      </section>
      <p className="mt-4 text-xs text-[var(--muted)]">
        Optional third-party performance data is shown only when a labelled provider completes; no
        browser performance score is inferred from this report.
      </p>
      <h3 className="mt-8 text-lg font-semibold">Findings</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          aria-label="Search findings"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search findings"
          value={search}
        />
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
          {[
            'TECHNICAL',
            'SEO',
            'CONTENT',
            'BROKEN_LINK',
            'ACCESSIBILITY',
            'PERFORMANCE',
            'STRUCTURED_DATA',
            'MOBILE',
            'SECURITY',
          ].map((value) => (
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
                (!category || finding.category === category) &&
                (!search ||
                  `${finding.title} ${finding.description} ${finding.auditPage?.normalizedUrl ?? ''}`
                    .toLowerCase()
                    .includes(search.toLowerCase())),
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
      <p className="mt-3 text-xs text-[var(--muted)]">
        Accessibility results are automated static checks only; manual testing remains required.
      </p>
      <h3 className="mt-8 text-lg font-semibold">Link report</h3>
      {links.length ? (
        <ul className="mt-3 space-y-2 text-sm">
          {links.map((link) => (
            <li
              className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-raised)] p-3"
              key={link.id}
            >
              <strong>{link.status}</strong> · {link.kind} · {link.destinationUrl}
              {link.httpStatus ? ` (${link.httpStatus})` : ''}
              {link.sourceAuditPage ? (
                <p className="mt-1 text-[var(--muted)]">
                  From {link.sourceAuditPage.normalizedUrl}
                </p>
              ) : null}
              {link.redirectUrl ? (
                <p className="mt-1 text-[var(--muted)]">Redirects to {link.redirectUrl}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm">No links were recorded in the bounded crawl.</p>
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
              {page.metrics ? (
                <p className="mt-1 text-[var(--muted)]">
                  {page.metrics.htmlBytes.toLocaleString()} HTML bytes ·{' '}
                  {page.metrics.responseTimeMs ?? '—'} ms · {page.metrics.resourceCount} resources ·{' '}
                  {page.metrics.imageCount} images
                </p>
              ) : null}
              {page.structuredData?.length ? (
                <p className="mt-1 text-[var(--muted)]">
                  Structured data:{' '}
                  {page.structuredData
                    .map((item) => item.types.join(', ') || item.status)
                    .join(' · ')}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm">No crawled pages recorded.</p>
      )}
    </section>
  )
}
