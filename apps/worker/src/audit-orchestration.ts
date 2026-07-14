import type { AuditOrchestrationPayload } from '@growthos/config'
import { AuditPageStatus, AuditRunStatus, getDatabaseClient } from '@growthos/db'
import {
  enqueueDiscoveredLinks,
  discoverInternalLinks,
  MAX_CRAWL_PAGES,
  normalizeCrawlUrl,
} from './crawl-discovery.js'
import { HomepageFetchError } from './secure-homepage-fetcher.js'
import type { HomepageResponse, SecurePageFetcher } from './secure-homepage-fetcher.js'
import {
  MAX_SITEMAP_FILES,
  MAX_SITEMAP_URLS,
  parseRobots,
  sitemapCandidates,
} from './robots-sitemaps.js'
import { evaluateFindings } from './finding-rules.js'
import {
  analysePageHtml,
  evaluateAdvancedFindings,
  type AdvancedPageAnalysis,
} from './advanced-analysis.js'
import { compareAuditRuns } from './audit-comparison.js'
import { scoreAudit, SCORING_VERSION } from './audit-scoring.js'
import { DisabledPerformanceProvider, type PerformanceProvider } from './performance-provider.js'

interface AuditRecord {
  id: string
  organizationId: string
  websiteId: string
  status: AuditRunStatus
  version: number
  previousAuditRunId?: string | null
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
  auditPage: {
    upsert(args: object): Promise<unknown>
    findMany(args: object): Promise<
      {
        id: string
        normalizedUrl: string
        status: AuditPageStatus
        errorCode?: string | null
        httpStatus?: number | null
        title?: string | null
        metaDescription?: string | null
        canonicalUrl?: string | null
        wordCount?: number | null
        loadDurationMs?: number | null
      }[]
    >
    count?(args: object): Promise<number>
  }
  auditFinding: {
    upsert(args: object): Promise<unknown>
    findMany?(args: object): Promise<{ fingerprint: string; severity: string }[]>
  }
  auditPageMetric?: {
    upsert(args: object): Promise<unknown>
    findMany?(
      args: object,
    ): Promise<{ auditPageId: string; summary: unknown; contentHash?: string | null }[]>
  }
  auditLink?: {
    upsert(args: object): Promise<unknown>
    findMany?(
      args: object,
    ): Promise<
      { id: string; destinationUrl: string; kind: string; sourceAuditPageId?: string | null }[]
    >
    updateMany?(args: object): Promise<unknown>
  }
  auditStructuredData?: { upsert(args: object): Promise<unknown> }
  auditCategoryScore?: {
    upsert(args: object): Promise<unknown>
    findMany?(args: object): Promise<{ category: string; score: number }[]>
  }
  auditComparison?: { upsert(args: object): Promise<unknown> }
  auditProviderExecution?: { upsert(args: object): Promise<unknown> }
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
    private readonly performanceProvider: PerformanceProvider = new DisabledPerformanceProvider(),
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
      await this.checkLinks(audit.id)
      if ((await this.status(audit.id)) !== AuditRunStatus.CRAWLING) return
      if (!(await this.transition(audit.id, AuditRunStatus.CRAWLING, AuditRunStatus.ANALYZING)))
        return
      const providerFailed = await this.analyse(audit)
      const pages = await this.database.auditPage.findMany({ where: { auditRunId: audit.id } })
      const terminal =
        providerFailed || pages.some((page) => page.status === AuditPageStatus.FAILED)
          ? AuditRunStatus.PARTIAL
          : AuditRunStatus.COMPLETED
      await this.database.auditRun.updateMany({
        where: { id: audit.id, status: AuditRunStatus.ANALYZING },
        data: {
          status: terminal,
          progressStage: 'report_finalised',
          completedAt: new Date(),
          version: { increment: 1 },
        },
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
            in: [
              AuditRunStatus.QUEUED,
              AuditRunStatus.VALIDATING_TARGET,
              AuditRunStatus.CRAWLING,
              AuditRunStatus.ANALYZING,
            ],
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
        ...(to === AuditRunStatus.VALIDATING_TARGET ? { progressStage: 'validating_target' } : {}),
        ...(to === AuditRunStatus.CRAWLING ? { progressStage: 'crawling_pages' } : {}),
        ...(to === AuditRunStatus.ANALYZING ? { progressStage: 'analysing_findings' } : {}),
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
    const approvedHost = new URL(homepage.finalUrl).hostname
    const robots = await this.robots(homepage.finalUrl)
    if (!robots) {
      await this.database.auditRun.updateMany({
        where: { id: auditId, status: AuditRunStatus.CRAWLING },
        data: { pagesDiscovered: 1, pagesProcessed: 1, version: { increment: 1 } },
      })
      return
    }
    enqueueDiscoveredLinks(
      queue,
      seen,
      discoverInternalLinks(homepage.body.toString('utf8'), homepage.finalUrl, approvedHost).filter(
        (url) => robots.allows(url),
      ),
      1,
    )
    const sitemapUrls = robots.sitemaps.length
      ? robots.sitemaps
          .map((url) => normalizeCrawlUrl(url, homepage.finalUrl, approvedHost))
          .filter((url): url is string => Boolean(url))
      : [new URL('/sitemap.xml', homepage.finalUrl).toString()]
    const sitemapQueue = sitemapUrls.map((url) => ({ url, depth: 0 }))
    let sitemapFiles = 0
    while (sitemapQueue.length && sitemapFiles < MAX_SITEMAP_FILES) {
      const sitemapCandidate = sitemapQueue.shift()
      if (!sitemapCandidate) break
      const sitemapUrl = sitemapCandidate.url
      if ((await this.status(auditId)) !== AuditRunStatus.CRAWLING) return
      try {
        const sitemap = await this.fetcher.fetch(sitemapUrl, undefined, [
          'application/xml',
          'text/xml',
        ])
        sitemapFiles += 1
        if (sitemap.httpStatus >= 400) continue
        const candidates = sitemapCandidates(
          sitemap.body.toString('utf8'),
          sitemap.finalUrl,
          approvedHost,
        )
        enqueueDiscoveredLinks(
          queue,
          seen,
          candidates.pages.filter((url) => robots.allows(url)).slice(0, MAX_SITEMAP_URLS),
          1,
        )
        if (sitemapCandidate.depth < 2)
          for (const index of candidates.indexes)
            sitemapQueue.push({ url: index, depth: sitemapCandidate.depth + 1 })
      } catch {
        // Discovery documents are non-terminal; normal internal links remain crawlable.
      }
    }
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
            approvedHost,
          ).filter((url) => robots.allows(url)),
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

  private async robots(finalHomepageUrl: string) {
    try {
      const url = new URL('/robots.txt', finalHomepageUrl).toString()
      const response = await this.fetcher.fetch(url, undefined, ['text/plain', 'text/xml'])
      if (response.httpStatus === 404) return parseRobots('', finalHomepageUrl)
      if (response.httpStatus >= 400) return undefined
      return parseRobots(response.body.toString('utf8').slice(0, 512 * 1024), finalHomepageUrl)
    } catch {
      // Conservative policy: do not discover additional pages when robots cannot be obtained.
      return undefined
    }
  }

  /** Link checks are deliberately sequential and bounded. The secure fetcher
   * revalidates every target and redirect; no external response body is stored
   * and no external page is ever added to the crawl queue. */
  private async checkLinks(auditId: string): Promise<void> {
    if (!this.database.auditLink?.findMany || !this.database.auditLink.updateMany) return
    await this.database.auditRun.updateMany({
      where: { id: auditId, status: AuditRunStatus.CRAWLING },
      data: { progressStage: 'checking_links', version: { increment: 1 } },
    })
    const links = await this.database.auditLink.findMany({
      where: { auditRunId: auditId, kind: { in: ['INTERNAL', 'EXTERNAL'] } },
      take: 200,
      orderBy: { firstDiscoveredAt: 'asc' },
    })
    let checked = 0
    for (const link of links) {
      if ((await this.status(auditId)) !== AuditRunStatus.CRAWLING) return
      try {
        const response = await this.fetcher.fetch(link.destinationUrl, undefined, ['*'])
        const redirected = response.finalUrl !== link.destinationUrl
        await this.database.auditLink.updateMany({
          where: { id: link.id },
          data: {
            status: response.httpStatus >= 400 ? 'BROKEN' : redirected ? 'REDIRECT' : 'WORKING',
            httpStatus: response.httpStatus,
            ...(redirected ? { redirectUrl: response.finalUrl, redirectDepth: 1 } : {}),
            failureCode: null,
          },
        })
      } catch (error) {
        await this.database.auditLink.updateMany({
          where: { id: link.id },
          data: {
            status: 'FAILED',
            failureCode: error instanceof HomepageFetchError ? error.code : 'LINK_CHECK_FAILED',
          },
        })
      }
      checked += 1
    }
    await this.database.auditRun.updateMany({
      where: { id: auditId, status: AuditRunStatus.CRAWLING },
      data: { linksChecked: checked, progressStage: 'analysing_seo', version: { increment: 1 } },
    })
  }

  private async analyse(audit: AuditRecord): Promise<boolean> {
    const pages = await this.database.auditPage.findMany({ where: { auditRunId: audit.id } })
    const metrics = this.database.auditPageMetric?.findMany
      ? await this.database.auditPageMetric.findMany({
          where: { auditPage: { auditRunId: audit.id } },
        })
      : []
    const metricsByPageId = new Map(metrics.map((metric) => [metric.auditPageId, metric]))
    const advancedPages = pages.flatMap((page) => {
      const analysis = advancedAnalysis(metricsByPageId.get(page.id)?.summary)
      return analysis
        ? [
            {
              id: page.id,
              normalizedUrl: page.normalizedUrl,
              ...(page.httpStatus === undefined ? {} : { httpStatus: page.httpStatus }),
              ...(page.loadDurationMs === undefined ? {} : { loadDurationMs: page.loadDurationMs }),
              analysis,
            },
          ]
        : []
    })
    const allFindings = [...evaluateFindings(pages), ...evaluateAdvancedFindings(advancedPages)]
    for (const item of allFindings) {
      await this.database.auditFinding.upsert({
        where: { auditRunId_fingerprint: { auditRunId: audit.id, fingerprint: item.fingerprint } },
        create: {
          auditRunId: audit.id,
          auditPageId: item.pageId,
          category: item.category,
          ruleId: item.ruleId,
          severity: item.severity,
          title: item.title,
          description: item.description,
          evidence: item.evidence,
          recommendationTemplate: item.recommendationTemplate,
          fingerprint: item.fingerprint,
        },
        update: {
          severity: item.severity,
          title: item.title,
          description: item.description,
          evidence: item.evidence,
          recommendationTemplate: item.recommendationTemplate,
          lastDetectedAt: new Date(),
          resolvedAt: null,
        },
      })
    }
    const scores = scoreAudit(allFindings)
    for (const score of scores) {
      await this.database.auditCategoryScore?.upsert({
        where: { auditRunId_category: { auditRunId: audit.id, category: score.category } },
        create: {
          auditRunId: audit.id,
          category: score.category,
          score: score.score,
          findingCount: score.findingCount,
          methodologyVersion: SCORING_VERSION,
          explanation: score.explanation,
        },
        update: {
          score: score.score,
          findingCount: score.findingCount,
          methodologyVersion: SCORING_VERSION,
          explanation: score.explanation,
        },
      })
    }
    await this.database.auditRun.updateMany({
      where: { id: audit.id, status: AuditRunStatus.ANALYZING },
      data: { progressStage: 'comparing_previous_audit', version: { increment: 1 } },
    })
    const previousFindings = audit.previousAuditRunId
      ? await this.database.auditFinding.findMany?.({
          where: { auditRunId: audit.previousAuditRunId },
          select: { fingerprint: true, severity: true },
        })
      : undefined
    const previousScores = audit.previousAuditRunId
      ? await this.database.auditCategoryScore?.findMany?.({
          where: {
            auditRunId: audit.previousAuditRunId,
            methodologyVersion: SCORING_VERSION,
          },
          select: { category: true, score: true },
        })
      : undefined
    const previousPageCount = audit.previousAuditRunId
      ? await this.database.auditPage.count?.({ where: { auditRunId: audit.previousAuditRunId } })
      : undefined
    const comparison = compareAuditRuns({
      currentFindings: allFindings.map((finding) => ({
        fingerprint: finding.fingerprint,
        severity: finding.severity,
      })),
      ...(previousFindings ? { previousFindings } : {}),
      currentPageCount: pages.length,
      ...(previousPageCount === undefined ? {} : { previousPageCount }),
      currentScores: scores,
      ...(previousScores ? { previousScores } : {}),
    })
    await this.database.auditComparison?.upsert({
      where: { auditRunId: audit.id },
      create: { auditRunId: audit.id, previousAuditRunId: audit.previousAuditRunId, ...comparison },
      update: { previousAuditRunId: audit.previousAuditRunId, ...comparison },
    })
    const provider = await this.runPerformanceProvider(audit)
    return provider.status === 'FAILED'
  }

  private async runPerformanceProvider(audit: AuditRecord) {
    try {
      const result = await this.performanceProvider.measure({
        auditRunId: audit.id,
        websiteUrl: audit.website.url,
      })
      await this.database.auditProviderExecution?.upsert({
        where: { auditRunId_provider: { auditRunId: audit.id, provider: result.provider } },
        create: {
          auditRunId: audit.id,
          provider: result.provider,
          status: result.status,
          metrics: result.metrics,
          ...(result.errorCode ? { errorCode: result.errorCode } : {}),
        },
        update: {
          status: result.status,
          metrics: result.metrics,
          ...(result.errorCode ? { errorCode: result.errorCode } : { errorCode: null }),
          measuredAt: new Date(),
        },
      })
      return result
    } catch {
      const result = {
        provider: 'configured',
        status: 'FAILED' as const,
        metrics: {},
        errorCode: 'PERFORMANCE_PROVIDER_FAILED',
      }
      await this.database.auditProviderExecution?.upsert({
        where: { auditRunId_provider: { auditRunId: audit.id, provider: result.provider } },
        create: { auditRunId: audit.id, ...result },
        update: { ...result, measuredAt: new Date() },
      })
      this.logger.error(
        { auditId: audit.id, provider: result.provider },
        'performance provider failed',
      )
      return result
    }
  }

  private async persistSuccess(
    auditId: string,
    requestedUrl: string,
    response: HomepageResponse,
  ): Promise<void> {
    const html = response.body.toString('utf8')
    const metadata = extractPageMetadata(html)
    const analysis = analysePageHtml({
      html,
      pageUrl: response.finalUrl,
      ...(response.headers ? { responseHeaders: response.headers } : {}),
    })
    const persisted = (await this.database.auditPage.upsert({
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
    })) as { id?: string } | undefined
    if (!persisted?.id) return
    await this.database.auditPageMetric?.upsert({
      where: { auditPageId: persisted.id },
      create: metricData(persisted.id, analysis, response.durationMs),
      update: metricData(persisted.id, analysis, response.durationMs),
    })
    for (const link of analysis.links) {
      if (!link.destinationUrl) continue
      await this.database.auditLink?.upsert({
        where: {
          auditRunId_sourceAuditPageId_destinationUrl: {
            auditRunId: auditId,
            sourceAuditPageId: persisted.id,
            destinationUrl: link.destinationUrl,
          },
        },
        create: { auditRunId: auditId, sourceAuditPageId: persisted.id, ...link },
        update: { ...link },
      })
    }
    for (const structuredData of analysis.structuredData) {
      await this.database.auditStructuredData?.upsert({
        where: {
          auditPageId_blockIndex: {
            auditPageId: persisted.id,
            blockIndex: structuredData.blockIndex,
          },
        },
        create: { auditPageId: persisted.id, ...structuredData },
        update: { ...structuredData },
      })
    }
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

function metricData(pageId: string, analysis: AdvancedPageAnalysis, durationMs: number) {
  return {
    auditPageId: pageId,
    htmlBytes: analysis.htmlBytes,
    responseTimeMs: durationMs,
    resourceCount: analysis.resourceCount,
    javascriptCount: analysis.javascriptCount,
    stylesheetCount: analysis.stylesheetCount,
    imageCount: analysis.imageCount,
    fontCount: analysis.fontCount,
    thirdPartyOriginCount: analysis.thirdPartyOriginCount,
    estimatedTransferBytes: analysis.estimatedTransferBytes,
    htmlLang: analysis.htmlLang,
    viewport: analysis.viewport,
    contentHash: analysis.contentHash,
    summary: analysis,
  }
}

function advancedAnalysis(value: unknown): AdvancedPageAnalysis | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const candidate = value as Partial<AdvancedPageAnalysis>
  return typeof candidate.contentHash === 'string' && Array.isArray(candidate.links)
    ? (candidate as AdvancedPageAnalysis)
    : undefined
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
