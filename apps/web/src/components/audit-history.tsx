'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { apiRequest } from '../lib/api'
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
    <section className="mt-6 rounded-xl border border-[var(--line)] bg-white p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Audit history</h2>
        <button
          className="rounded-md bg-[var(--accent)] px-3 py-2 font-semibold text-white"
          onClick={() => void start()}
          type="button"
        >
          Start audit
        </button>
      </div>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Queued audits wait for the Phase 4D worker; no website is fetched here.
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
            <Link className="rounded-md border px-3 py-2" href={`${base}/${audit.id}`}>
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
  useEffect(() => {
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
  }, [auditId, websiteId, context.headers])
  if (error)
    return (
      <p role="alert" className="text-red-800">
        {error}
      </p>
    )
  if (!audit) return <p>Loading audit…</p>
  return (
    <section className="max-w-2xl rounded-xl border border-[var(--line)] bg-white p-6">
      <Link className="font-semibold text-[var(--accent)]" href={listHref}>
        ← Website
      </Link>
      <h2 className="mt-5 text-xl font-semibold">Audit status: {audit.status}</h2>
      <dl className="mt-4 grid gap-3 text-sm">
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
      <h3 className="mt-6 text-lg font-semibold">Findings</h3>
      {findings.length ? (
        <ul className="mt-3 space-y-3">
          {findings.map((finding) => (
            <li className="rounded border p-3 text-sm" key={finding.id}>
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
    </section>
  )
}
