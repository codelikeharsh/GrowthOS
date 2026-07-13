import { AuditPageStatus, AuditRunStatus } from '@growthos/db'
import { describe, expect, it, vi } from 'vitest'
import { AuditOrchestrationConsumer, type AuditWorkerDatabase } from './audit-orchestration.js'
import type { HomepageResponse, SecurePageFetcher } from './secure-homepage-fetcher.js'

const response = (url: string, html: string): HomepageResponse => ({
  finalUrl: url,
  httpStatus: 200,
  contentType: 'text/html',
  body: Buffer.from(html),
  durationMs: 1,
  connection: { address: '93.184.216.34', family: 4, port: 443, hostHeader: 'example.com' },
})

describe('audit orchestration bounded crawl', () => {
  it('crawls safe internal pages, persists page failures, and completes analysis', async () => {
    let status: AuditRunStatus = AuditRunStatus.QUEUED
    const pages: object[] = []
    const database: AuditWorkerDatabase = {
      auditRun: {
        findUnique: vi.fn(() =>
          Promise.resolve({
            id: 'audit',
            organizationId: 'org',
            websiteId: 'site',
            status,
            version: 1,
            website: {
              id: 'site',
              businessOrganizationId: 'org',
              url: 'https://example.com/',
              normalizedUrl: 'https://example.com/',
              isActive: true,
            },
          }),
        ),
        updateMany: vi.fn(
          (args: {
            where: { status?: AuditRunStatus | { in: AuditRunStatus[] } }
            data: { status?: AuditRunStatus }
          }) => {
            const expected = args.where.status
            const allowed = typeof expected === 'object' ? expected.in : [expected]
            if (!allowed.includes(status)) return Promise.resolve({ count: 0 })
            if (args.data.status) status = args.data.status
            return Promise.resolve({ count: 1 })
          },
        ),
      },
      auditPage: {
        upsert: vi.fn((args: object) => {
          pages.push(args)
          return Promise.resolve()
        }),
        findMany: vi.fn(() => Promise.resolve([])),
      },
      auditFinding: { upsert: vi.fn(() => Promise.resolve()) },
      $transaction: async (callback) => callback(database),
    }
    const fetcher: SecurePageFetcher = {
      fetch: (url) => {
        if (url.endsWith('/failed')) return Promise.reject(new Error('timeout'))
        if (url.endsWith('/about')) return Promise.resolve(response(url, '<p>About</p>'))
        return Promise.resolve(
          response(
            url,
            '<a href="/about">About</a><a href="/failed">Failed</a><a href="https://other.test/">Other</a>',
          ),
        )
      },
    }
    const consumer = new AuditOrchestrationConsumer(
      fetcher,
      { info: vi.fn(), error: vi.fn() },
      database,
    )
    await consumer.process({ auditRunId: 'audit', websiteId: 'site', organizationId: 'org' })
    expect(status).toBe(AuditRunStatus.COMPLETED)
    expect(pages).toHaveLength(3)
    expect(JSON.stringify(pages)).toContain(AuditPageStatus.FAILED)
  })
})
