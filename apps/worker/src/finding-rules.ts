import { createHash } from 'node:crypto'
import { AuditFindingCategory, AuditFindingSeverity, AuditPageStatus } from '@growthos/db'

export interface PageForFinding {
  id: string
  normalizedUrl: string
  status: AuditPageStatus
  errorCode?: string | null
  httpStatus?: number | null
  title?: string | null
  metaDescription?: string | null
  canonicalUrl?: string | null
  wordCount?: number | null
}
export interface DeterministicFinding {
  pageId?: string
  category: AuditFindingCategory
  ruleId: string
  severity: AuditFindingSeverity
  title: string
  description: string
  evidence: object
  recommendationTemplate: string
  fingerprint: string
}

export function evaluateFindings(pages: PageForFinding[]): DeterministicFinding[] {
  const findings: DeterministicFinding[] = []
  for (const page of pages) {
    if (page.status === AuditPageStatus.FAILED)
      findings.push(
        finding(
          page,
          'TECHNICAL_PAGE_FETCH_FAILED',
          AuditFindingCategory.TECHNICAL,
          AuditFindingSeverity.HIGH,
          'Page fetch failed',
          'This page could not be fetched during the audit.',
          'Resolve the page fetch error and run the audit again.',
        ),
      )
    else if (page.httpStatus && page.httpStatus >= 500)
      findings.push(
        finding(
          page,
          'TECHNICAL_HTTP_5XX',
          AuditFindingCategory.TECHNICAL,
          AuditFindingSeverity.HIGH,
          'Server error response',
          'This page returned a server error response.',
          'Investigate and correct the server error.',
        ),
      )
    else if (page.httpStatus && page.httpStatus >= 400)
      findings.push(
        finding(
          page,
          'TECHNICAL_HTTP_4XX',
          AuditFindingCategory.TECHNICAL,
          AuditFindingSeverity.MEDIUM,
          'Client error response',
          'This page returned a client error response.',
          'Confirm that this page should be available and correct the response.',
        ),
      )
    if (page.status === AuditPageStatus.FETCHED) {
      if (!page.title)
        findings.push(
          finding(
            page,
            'SEO_TITLE_MISSING',
            AuditFindingCategory.SEO,
            AuditFindingSeverity.MEDIUM,
            'Page title is missing',
            'This page does not provide a title.',
            'Add a concise, descriptive page title.',
          ),
        )
      else if (page.title.length < 10)
        findings.push(
          finding(
            page,
            'SEO_TITLE_SHORT',
            AuditFindingCategory.SEO,
            AuditFindingSeverity.LOW,
            'Page title is very short',
            'This page title is shorter than 10 characters.',
            'Use a concise title that describes the page.',
          ),
        )
      else if (page.title.length > 60)
        findings.push(
          finding(
            page,
            'SEO_TITLE_LONG',
            AuditFindingCategory.SEO,
            AuditFindingSeverity.LOW,
            'Page title is long',
            'This page title exceeds 60 characters.',
            'Shorten the title while retaining its description.',
          ),
        )
      if (!page.metaDescription)
        findings.push(
          finding(
            page,
            'SEO_META_DESCRIPTION_MISSING',
            AuditFindingCategory.SEO,
            AuditFindingSeverity.LOW,
            'Meta description is missing',
            'This page does not provide a meta description.',
            'Add a concise description that accurately summarizes this page.',
          ),
        )
      else if (page.metaDescription.length < 50)
        findings.push(
          finding(
            page,
            'SEO_META_DESCRIPTION_SHORT',
            AuditFindingCategory.SEO,
            AuditFindingSeverity.LOW,
            'Meta description is very short',
            'This page meta description is shorter than 50 characters.',
            'Use a concise, page-specific description that explains the page.',
          ),
        )
      else if (page.metaDescription.length > 160)
        findings.push(
          finding(
            page,
            'SEO_META_DESCRIPTION_LONG',
            AuditFindingCategory.SEO,
            AuditFindingSeverity.LOW,
            'Meta description is long',
            'This page meta description exceeds 160 characters.',
            'Shorten the description while preserving its useful summary.',
          ),
        )
      if (!page.canonicalUrl)
        findings.push(
          finding(
            page,
            'SEO_CANONICAL_MISSING',
            AuditFindingCategory.SEO,
            AuditFindingSeverity.LOW,
            'Canonical URL is missing',
            'This page does not provide a canonical URL.',
            'Add a canonical URL for this page.',
          ),
        )
      else if (!sameHost(page.normalizedUrl, page.canonicalUrl))
        findings.push(
          finding(
            page,
            'SEO_CANONICAL_CROSS_HOST',
            AuditFindingCategory.SEO,
            AuditFindingSeverity.MEDIUM,
            'Canonical points to another host',
            'The canonical URL points to a host other than the crawled page host.',
            'Confirm the cross-host canonical is intentional, or use the canonical host for this page.',
          ),
        )
      if ((page.wordCount ?? 0) < 100)
        findings.push(
          finding(
            page,
            'CONTENT_THIN',
            AuditFindingCategory.CONTENT,
            AuditFindingSeverity.LOW,
            'Visible content is limited',
            'This page has fewer than 100 visible words.',
            'Add useful, page-specific content where appropriate.',
          ),
        )
    }
  }
  for (const [field, ruleId, title] of [
    ['title', 'SEO_TITLE_DUPLICATE', 'Duplicate page title'],
    ['metaDescription', 'SEO_META_DESCRIPTION_DUPLICATE', 'Duplicate meta description'],
  ] as const) {
    const groups = new Map<string, PageForFinding[]>()
    for (const page of pages) {
      const value = page[field]
      if (value) groups.set(value, [...(groups.get(value) ?? []), page])
    }
    for (const group of groups.values())
      if (group.length > 1)
        for (const page of group)
          findings.push(
            finding(
              page,
              ruleId,
              AuditFindingCategory.SEO,
              AuditFindingSeverity.LOW,
              title,
              `This ${field === 'title' ? 'title' : 'meta description'} appears on multiple crawled pages.`,
              'Use a distinct description for each page.',
            ),
          )
  }
  return findings
}

function sameHost(pageUrl: string, canonicalUrl: string): boolean {
  try {
    return new URL(pageUrl).hostname === new URL(canonicalUrl, pageUrl).hostname
  } catch {
    return false
  }
}

function finding(
  page: PageForFinding,
  ruleId: string,
  category: AuditFindingCategory,
  severity: AuditFindingSeverity,
  title: string,
  description: string,
  recommendationTemplate: string,
): DeterministicFinding {
  const fingerprint = createHash('sha256').update(`${ruleId}:${page.normalizedUrl}`).digest('hex')
  return {
    pageId: page.id,
    category,
    ruleId,
    severity,
    title,
    description,
    evidence: {
      pageUrl: page.normalizedUrl,
      httpStatus: page.httpStatus ?? null,
      errorCode: page.errorCode ?? null,
    },
    recommendationTemplate,
    fingerprint,
  }
}
