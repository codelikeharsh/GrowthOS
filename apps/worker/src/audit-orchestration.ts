import type { AuditOrchestrationPayload } from '@growthos/config'
import { AuditPageStatus, AuditRunStatus, getDatabaseClient } from '@growthos/db'
import {
  enqueueDiscoveredLinks,
  discoverInternalLinks,
  MAX_CRAWL_PAGES,
} from './crawl-discovery.js'
import { HomepageFetchError } from './secure-homepage-fetcher.js'
import type { HomepageResponse, SecurePageFetcher } from './secure-homepage-fetcher.js'

interface AuditRecord {
  id: string
  organizationId: string
  websiteId: string
  status: AuditRunStatus
  version: number
  website: {
    id: string
    businessOrganizationId: string
    url: string
    normalizedUrl: string
    isActive: boolean
  }
}

export interface AuditWorkerDatabase {
  auditRun: {
    findUnique(args: object): Promise<AuditRecord | null>
    updateMany(args: object): Promise<{ count: number }>
  }
  auditPage: { upsert(args: object): Promise<unknown> }
  $transaction<T>(callback: (transaction: AuditWorkerDatabase) => Promise<T>): Promise<T>
}

export interface AuditWorkerLogger {
  info(bindings: object, message: string): void
  error(bindings: object, message: string): void
}

export class AuditOrchestrationConsumer {
  constructor(
    private readonly fetcher: SecurePageFetcher,
    private readonly logger: AuditWorkerLogger,
    private readonly database: AuditWorkerDatabase = getDatabaseClient() as unknown as AuditWorkerDatabase,
  ) {}

  async process(payload: AuditOrchestrationPayload, jobId?: string): Promise<void> {
    const context = {
      jobId,
      auditId: payload.auditRunId,
      websiteId: payload.websiteId,
      requestId: jobId,
    }
    const audit = await this.database.auditRun.findUnique({
      where: { id: payload.auditRunId },
      include: { website: true },
    })
    if (
      !audit ||
      audit.websiteId !== payload.websiteId ||
      audit.organizationId !== payload.organizationId
    ) {
      this.logger.info(context, 'audit job ignored because its stable IDs no longer match')
      return
    }
    if (audit.status !== AuditRunStatus.QUEUED || !audit.website.isActive) {
      this.logger.info(
        { ...context, status: audit.status },
        'audit job ignored because it is not runnable',
      )
      return
    }
    if (!(await this.transition(audit.id, AuditRunStatus.QUEUED, AuditRunStatus.VALIDATING_TARGET)))
      return
    try {
      const current = await this.status(audit.id)
      if (current !== AuditRunStatus.VALIDATING_TARGET) return
      if (
        !(await this.transition(
          audit.id,
          AuditRunStatus.VALIDATING_TARGET,
          AuditRunStatus.CRAWLING,
        ))
      )
        return
      const homepage = await this.fetcher.fetch(audit.website.url)
      if ((await this.status(audit.id)) !== AuditRunStatus.CRAWLING) return
      await this.crawl(audit.id, homepage, audit.website.url)
      if ((await this.status(audit.id)) !== AuditRunStatus.CRAWLING) return
      await this.database.auditRun.updateMany({
        where: { id: audit.id, status: AuditRunStatus.CRAWLING },
        data: { status: AuditRunStatus.ANALYZING, version: { increment: 1 } },
      })
      this.logger.info(
        { ...context, durationMs: homepage.durationMs },
        'audit bounded internal crawl completed safely',
      )
    } catch (error) {
      const code = error instanceof HomepageFetchError ? error.code : 'AUDIT_PAGE_FETCH_FAILED'
      await this.database.auditRun.updateMany({
        where: {
          id: audit.id,
          status: {
            in: [AuditRunStatus.QUEUED, AuditRunStatus.VALIDATING_TARGET, AuditRunStatus.CRAWLING],
          },
        },
        data: {
          status: AuditRunStatus.FAILED,
          failedAt: new Date(),
          failureCode: code,
          failureMessage: 'Homepage fetch failed safely',
          version: { increment: 1 },
        },
      })
      this.logger.error({ ...context, failureClass: code }, 'audit homepage processing failed')
    }
  }

  private async status(id: string): Promise<AuditRunStatus | undefined> {
    return (await this.database.auditRun.findUnique({ where: { id } }))?.status
  }

  private async transition(id: string, from: AuditRunStatus, to: AuditRunStatus): Promise<boolean> {
    const result = await this.database.auditRun.updateMany({
      where: { id, status: from },
      data: {
        status: to,
        ...(to === AuditRunStatus.VALIDATING_TARGET ? { startedAt: new Date() } : {}),
        version: { increment: 1 },
      },
    })
    return result.count === 1
  }

  private async crawl(
    auditId: string,
    homepage: HomepageResponse,
    requestedUrl: string,
  ): Promise<void> {
    const queue = [] as { url: string; depth: number }[]
    const seen = new Set([homepage.finalUrl])
    let processed = 0
    await this.persistSuccess(auditId, requestedUrl, homepage)
    processed += 1
    enqueueDiscoveredLinks(
      queue,
      seen,
      discoverInternalLinks(
        homepage.body.toString('utf8'),
        homepage.finalUrl,
        new URL(homepage.finalUrl).hostname,
      ),
      1,
    )
    while (queue.length && processed < MAX_CRAWL_PAGES) {
      if ((await this.status(auditId)) !== AuditRunStatus.CRAWLING) return
      const candidate = queue.shift()
      if (!candidate) break
      try {
        const response = await this.fetcher.fetch(candidate.url)
        if ((await this.status(auditId)) !== AuditRunStatus.CRAWLING) return
        await this.persistSuccess(auditId, candidate.url, response)
        enqueueDiscoveredLinks(
          queue,
          seen,
          discoverInternalLinks(
            response.body.toString('utf8'),
            response.finalUrl,
            new URL(homepage.finalUrl).hostname,
          ),
          candidate.depth + 1,
        )
      } catch (error) {
        if ((await this.status(auditId)) !== AuditRunStatus.CRAWLING) return
        await this.persistFailure(
          auditId,
          candidate.url,
          error instanceof HomepageFetchError ? error.code : 'AUDIT_PAGE_FETCH_FAILED',
        )
      }
      processed += 1
    }
    await this.database.auditRun.updateMany({
      where: { id: auditId, status: AuditRunStatus.CRAWLING },
      data: { pagesDiscovered: seen.size, pagesProcessed: processed, version: { increment: 1 } },
    })
  }

  private async persistSuccess(
    auditId: string,
    requestedUrl: string,
    response: HomepageResponse,
  ): Promise<void> {
    const metadata = extractPageMetadata(response.body.toString('utf8'))
    await this.database.auditPage.upsert({
      where: {
        auditRunId_normalizedUrl: { auditRunId: auditId, normalizedUrl: response.finalUrl },
      },
      create: {
        auditRunId: auditId,
        url: requestedUrl,
        normalizedUrl: response.finalUrl,
        canonicalUrl: metadata.canonicalUrl,
        httpStatus: response.httpStatus,
        contentType: response.contentType,
        title: metadata.title,
        metaDescription: metadata.metaDescription,
        wordCount: metadata.wordCount,
        loadDurationMs: response.durationMs,
        status: AuditPageStatus.FETCHED,
      },
      update: {
        url: requestedUrl,
        canonicalUrl: metadata.canonicalUrl,
        httpStatus: response.httpStatus,
        contentType: response.contentType,
        title: metadata.title,
        metaDescription: metadata.metaDescription,
        wordCount: metadata.wordCount,
        loadDurationMs: response.durationMs,
        status: AuditPageStatus.FETCHED,
        errorCode: null,
      },
    })
  }

  private async persistFailure(auditId: string, url: string, errorCode: string): Promise<void> {
    await this.database.auditPage.upsert({
      where: { auditRunId_normalizedUrl: { auditRunId: auditId, normalizedUrl: url } },
      create: {
        auditRunId: auditId,
        url,
        normalizedUrl: url,
        status: AuditPageStatus.FAILED,
        errorCode,
      },
      update: { status: AuditPageStatus.FAILED, errorCode },
    })
  }
}

export function extractPageMetadata(html: string): {
  title?: string
  metaDescription?: string
  canonicalUrl?: string
  wordCount: number
} {
  const title = match(html, /<title[^>]*>([\s\S]*?)<\/title>/i)
  const metaDescription =
    match(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i) ??
    match(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i)
  const canonicalUrl = match(
    html,
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["'][^>]*>/i,
  )
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/gi, ' ')
  return {
    ...(title ? { title: decode(title).slice(0, 1000) } : {}),
    ...(metaDescription ? { metaDescription: decode(metaDescription).slice(0, 2000) } : {}),
    ...(canonicalUrl ? { canonicalUrl: decode(canonicalUrl).slice(0, 2048) } : {}),
    wordCount: decode(text).trim().split(/\s+/).filter(Boolean).length,
  }
}

function match(value: string, pattern: RegExp): string | undefined {
  return pattern.exec(value)?.[1]?.trim()
}

function decode(value: string): string {
  return value.replace(
    /&(?:amp|quot|#39|lt|gt);/g,
    (entity) =>
      ({ '&amp;': '&', '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>' })[entity] ?? entity,
  )
}
