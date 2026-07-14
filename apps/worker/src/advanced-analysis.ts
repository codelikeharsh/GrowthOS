import { createHash } from 'node:crypto'
import {
  AuditFindingCategory,
  AuditFindingSeverity,
  AuditLinkKind,
  AuditLinkStatus,
  AuditStructuredDataStatus,
} from '@growthos/db'
import type { DeterministicFinding } from './finding-rules.js'

/** Bounded static-analysis limits. They deliberately live in one place so an
 * audit cannot grow without a reviewed product/security decision. */
export const ADVANCED_AUDIT_LIMITS = {
  maxLinksPerPage: 200,
  maxResourceRecords: 100,
  maxJsonLdBlocks: 20,
  maxAnchorLength: 500,
  largeHtmlBytes: 512 * 1024,
  slowResponseMs: 1_500,
  excessiveResources: 80,
  excessiveInternalLinks: 100,
  thinContentWords: 100,
  largeImageHintBytes: 250 * 1024,
} as const

export interface AnalysedLink {
  destinationUrl: string
  kind: AuditLinkKind
  anchorText?: string
  status: AuditLinkStatus
  failureCode?: string
}

export interface StructuredDataBlock {
  blockIndex: number
  status: AuditStructuredDataStatus
  types: string[]
  context?: string
  summary: Record<string, unknown>
}

export interface AdvancedPageAnalysis {
  htmlBytes: number
  resourceCount: number
  javascriptCount: number
  stylesheetCount: number
  imageCount: number
  fontCount: number
  thirdPartyOriginCount: number
  estimatedTransferBytes: number
  htmlLang?: string
  viewport?: string
  contentHash: string
  wordCount: number
  h1Count: number
  h1Text?: string
  headingLevels: number[]
  imageMissingAltCount: number
  imageMissingDimensionsCount: number
  unlabeledControlCount: number
  unnamedButtonCount: number
  unnamedLinkCount: number
  duplicateIdCount: number
  iframeMissingTitleCount: number
  noindex: boolean
  conflictingRobots: boolean
  hasCanonical: boolean
  hasOpenGraph: boolean
  hasTwitterCard: boolean
  hasMainLandmark: boolean
  hasCompression: boolean
  hasCsp: boolean
  hasHsts: boolean
  hasXContentTypeOptions: boolean
  hasFrameProtection: boolean
  hasReferrerPolicy: boolean
  hasServerHeader: boolean
  mixedContentCount: number
  unsafeBlankLinkCount: number
  insecureFormActionCount: number
  fixedWidthHintCount: number
  links: AnalysedLink[]
  structuredData: StructuredDataBlock[]
}

export interface AnalysePageInput {
  html: string
  pageUrl: string
  responseHeaders?: Record<string, string | string[] | undefined>
}

/**
 * Extracts compact, deterministic facts from already-fetched HTML. This never
 * executes scripts, makes network requests, or treats static inspection as a
 * browser/WCAG/security certification.
 */
export function analysePageHtml(input: AnalysePageInput): AdvancedPageAnalysis {
  const html = input.html.slice(0, 2 * 1024 * 1024)
  const page = new URL(input.pageUrl)
  const headers = lowerCaseHeaders(input.responseHeaders)
  const tags = [...html.matchAll(/<([a-zA-Z][\w:-]*)(?:\s[^<>]*?)?>/g)]
  const attributes = (tag: string): Record<string, string> => readAttributes(tag)
  const text = visibleText(html)
  const ids = new Map<string, number>()
  const headingLevels: number[] = []
  let h1Count = 0
  let imageMissingAltCount = 0
  let imageMissingDimensionsCount = 0
  let iframeMissingTitleCount = 0
  let fixedWidthHintCount = 0
  let hasMainLandmark = false
  let javascriptCount = 0
  let stylesheetCount = 0
  let imageCount = 0
  let fontCount = 0
  const resourceOrigins = new Set<string>()

  for (const match of tags) {
    const tagName = (match[1] ?? '').toLowerCase()
    const raw = match[0]
    const attrs = attributes(raw)
    const id = attrs.id
    if (id) ids.set(id, (ids.get(id) ?? 0) + 1)
    if (/^h[1-6]$/.test(tagName)) {
      const level = Number(tagName[1])
      headingLevels.push(level)
      if (level === 1) h1Count += 1
    }
    if (tagName === 'main' || attrs.role === 'main') hasMainLandmark = true
    if (tagName === 'img') {
      imageCount += 1
      if (!('alt' in attrs)) imageMissingAltCount += 1
      if (!attrs.width || !attrs.height) imageMissingDimensionsCount += 1
      addOrigin(resourceOrigins, attrs.src, page)
    }
    if (tagName === 'script' && attrs.src) {
      javascriptCount += 1
      addOrigin(resourceOrigins, attrs.src, page)
    }
    if (tagName === 'link' && /(?:^|\s)stylesheet(?:\s|$)/i.test(attrs.rel ?? '')) {
      stylesheetCount += 1
      addOrigin(resourceOrigins, attrs.href, page)
    }
    if (tagName === 'link' && /(?:^|\s)(?:preload|stylesheet)(?:\s|$)/i.test(attrs.rel ?? '')) {
      if ((attrs.as ?? '').toLowerCase() === 'font' || /font/i.test(attrs.href ?? ''))
        fontCount += 1
      addOrigin(resourceOrigins, attrs.href, page)
    }
    if (tagName === 'iframe' && !attrs.title?.trim()) iframeMissingTitleCount += 1
    if (/\bwidth\s*[:=]\s*["']?(?:[89]\d\d|[1-9]\d{3,})/i.test(raw)) fixedWidthHintCount += 1
  }

  const links = collectLinks(html, page)
  const controls = controlsWithoutLabels(html)
  const noindex = robotsHas(html, 'noindex')
  const conflictingRobots = noindex && robotsHas(html, 'index')
  const viewport = metaContent(html, 'viewport')
  const lang = readAttributes(/<html\b[^>]*>/i.exec(html)?.[0] ?? '').lang
  const h1Text = normalizeText(
    [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/gi)]
      .map((match) => visibleText(match[1] ?? ''))
      .join(' '),
  )
  const structuredData = parseStructuredData(html, page)
  const hasCsp = Boolean(headers['content-security-policy'])
  const hasFrameProtection =
    hasCsp && /frame-ancestors/i.test(String(headers['content-security-policy']))
  const mixedContentCount = countMixedContent(html, page)
  return {
    htmlBytes: Buffer.byteLength(html),
    resourceCount: Math.min(
      ADVANCED_AUDIT_LIMITS.maxResourceRecords,
      javascriptCount + stylesheetCount + imageCount + fontCount,
    ),
    javascriptCount,
    stylesheetCount,
    imageCount,
    fontCount,
    thirdPartyOriginCount: resourceOrigins.size,
    estimatedTransferBytes: Buffer.byteLength(html),
    ...(lang ? { htmlLang: lang } : {}),
    ...(viewport ? { viewport } : {}),
    contentHash: createHash('sha256').update(normalizeText(text)).digest('hex'),
    wordCount: text.split(/\s+/).filter(Boolean).length,
    h1Count,
    ...(h1Text ? { h1Text: h1Text.slice(0, 500) } : {}),
    headingLevels,
    imageMissingAltCount,
    imageMissingDimensionsCount,
    unlabeledControlCount: controls.unlabeled,
    unnamedButtonCount: controls.unnamedButtons,
    unnamedLinkCount: links.filter(
      (link) => !link.anchorText && link.kind !== AuditLinkKind.UNSUPPORTED,
    ).length,
    duplicateIdCount: [...ids.values()].filter((count) => count > 1).length,
    iframeMissingTitleCount,
    noindex,
    conflictingRobots,
    hasCanonical: /<link\b[^>]*\brel\s*=\s*(["'])canonical\1/i.test(html),
    hasOpenGraph: /<meta\b[^>]*(?:property|name)\s*=\s*(["'])og:/i.test(html),
    hasTwitterCard: /<meta\b[^>]*(?:property|name)\s*=\s*(["'])twitter:/i.test(html),
    hasMainLandmark,
    hasCompression: Boolean(headers['content-encoding']),
    hasCsp,
    hasHsts: Boolean(headers['strict-transport-security']),
    hasXContentTypeOptions: /nosniff/i.test(String(headers['x-content-type-options'] ?? '')),
    hasFrameProtection: hasFrameProtection || Boolean(headers['x-frame-options']),
    hasReferrerPolicy: Boolean(headers['referrer-policy']),
    hasServerHeader: Boolean(headers.server),
    mixedContentCount,
    unsafeBlankLinkCount: countUnsafeBlankLinks(html),
    insecureFormActionCount: countInsecureFormActions(html, page),
    fixedWidthHintCount,
    links,
    structuredData,
  }
}

export interface AdvancedFindingPage {
  id: string
  normalizedUrl: string
  httpStatus?: number | null
  loadDurationMs?: number | null
  analysis: AdvancedPageAnalysis
}

export function evaluateAdvancedFindings(pages: AdvancedFindingPage[]): DeterministicFinding[] {
  const findings: DeterministicFinding[] = []
  for (const page of pages) {
    const facts = page.analysis
    if (!facts.htmlLang)
      findings.push(
        rule(
          page,
          'A11Y_LANG_MISSING',
          AuditFindingCategory.ACCESSIBILITY,
          AuditFindingSeverity.MEDIUM,
          'Document language is missing',
          'The HTML document does not declare a language.',
          'Set the html lang attribute to the primary page language.',
        ),
      )
    if (!facts.viewport)
      findings.push(
        rule(
          page,
          'MOBILE_VIEWPORT_MISSING',
          AuditFindingCategory.MOBILE,
          AuditFindingSeverity.MEDIUM,
          'Viewport meta tag is missing',
          'This page does not declare a responsive viewport.',
          'Add a viewport meta tag such as width=device-width, initial-scale=1.',
        ),
      )
    if (facts.h1Count === 0)
      findings.push(
        rule(
          page,
          'SEO_H1_MISSING',
          AuditFindingCategory.SEO,
          AuditFindingSeverity.MEDIUM,
          'Primary heading is missing',
          'This page has no H1 element.',
          'Add one clear H1 that describes the page.',
        ),
      )
    if (facts.h1Count > 1)
      findings.push(
        rule(
          page,
          'SEO_H1_MULTIPLE',
          AuditFindingCategory.SEO,
          AuditFindingSeverity.LOW,
          'Multiple primary headings',
          'This page contains more than one H1 element.',
          'Use one primary H1 and structure lower headings underneath it.',
        ),
      )
    if (skipsHeadingLevel(facts.headingLevels))
      findings.push(
        rule(
          page,
          'A11Y_HEADING_ORDER',
          AuditFindingCategory.ACCESSIBILITY,
          AuditFindingSeverity.LOW,
          'Heading levels are skipped',
          'The page heading outline skips one or more levels.',
          'Use sequential heading levels to retain a clear document outline.',
        ),
      )
    if (facts.imageMissingAltCount)
      findings.push(
        rule(
          page,
          'A11Y_IMAGE_ALT_MISSING',
          AuditFindingCategory.ACCESSIBILITY,
          AuditFindingSeverity.MEDIUM,
          'Images are missing text alternatives',
          `${countText(facts.imageMissingAltCount)} image(s) do not provide an alt attribute.`,
          'Provide meaningful alt text, or an explicit empty alt for decorative images.',
        ),
      )
    if (facts.unlabeledControlCount)
      findings.push(
        rule(
          page,
          'A11Y_FORM_LABEL_MISSING',
          AuditFindingCategory.ACCESSIBILITY,
          AuditFindingSeverity.MEDIUM,
          'Form controls need labels',
          `${countText(facts.unlabeledControlCount)} control(s) have no associated label or accessible name.`,
          'Associate each form control with a visible label or an accessible name.',
        ),
      )
    if (facts.unnamedButtonCount)
      findings.push(
        rule(
          page,
          'A11Y_BUTTON_NAME_MISSING',
          AuditFindingCategory.ACCESSIBILITY,
          AuditFindingSeverity.MEDIUM,
          'Buttons need accessible names',
          `${countText(facts.unnamedButtonCount)} button(s) have no visible or programmatic name.`,
          'Give each button descriptive text or an aria-label.',
        ),
      )
    if (facts.duplicateIdCount)
      findings.push(
        rule(
          page,
          'A11Y_DUPLICATE_ID',
          AuditFindingCategory.ACCESSIBILITY,
          AuditFindingSeverity.LOW,
          'Duplicate element IDs',
          `${countText(facts.duplicateIdCount)} ID value(s) are repeated.`,
          'Make each id value unique within the document.',
        ),
      )
    if (!facts.hasMainLandmark)
      findings.push(
        rule(
          page,
          'A11Y_MAIN_LANDMARK_MISSING',
          AuditFindingCategory.ACCESSIBILITY,
          AuditFindingSeverity.LOW,
          'Main landmark is missing',
          'No main landmark was found in the static document.',
          'Use one main element or role="main" for primary page content.',
        ),
      )
    if (facts.iframeMissingTitleCount)
      findings.push(
        rule(
          page,
          'A11Y_IFRAME_TITLE_MISSING',
          AuditFindingCategory.ACCESSIBILITY,
          AuditFindingSeverity.LOW,
          'Embedded frames need titles',
          `${countText(facts.iframeMissingTitleCount)} iframe(s) have no title.`,
          'Add a concise title to each iframe.',
        ),
      )
    if (facts.htmlBytes > ADVANCED_AUDIT_LIMITS.largeHtmlBytes)
      findings.push(
        rule(
          page,
          'PERF_HTML_LARGE',
          AuditFindingCategory.PERFORMANCE,
          AuditFindingSeverity.MEDIUM,
          'HTML document is large',
          `The HTML response is ${countText(facts.htmlBytes)} bytes.`,
          'Reduce unnecessary markup and inline data in the initial response.',
        ),
      )
    if ((page.loadDurationMs ?? 0) > ADVANCED_AUDIT_LIMITS.slowResponseMs)
      findings.push(
        rule(
          page,
          'PERF_SERVER_RESPONSE_SLOW',
          AuditFindingCategory.PERFORMANCE,
          AuditFindingSeverity.MEDIUM,
          'Server response is slow',
          `The bounded request took ${countText(page.loadDurationMs ?? 0)} ms.`,
          'Investigate server work, caching, and upstream dependencies.',
        ),
      )
    if (facts.resourceCount > ADVANCED_AUDIT_LIMITS.excessiveResources)
      findings.push(
        rule(
          page,
          'PERF_RESOURCE_COUNT_HIGH',
          AuditFindingCategory.PERFORMANCE,
          AuditFindingSeverity.LOW,
          'Many first-page resources were discovered',
          `${countText(facts.resourceCount)} static resource references were found.`,
          'Reduce or defer non-essential scripts, stylesheets, images, and fonts.',
        ),
      )
    if (!facts.hasCompression)
      findings.push(
        rule(
          page,
          'PERF_COMPRESSION_MISSING',
          AuditFindingCategory.PERFORMANCE,
          AuditFindingSeverity.LOW,
          'Response compression was not detected',
          'The audited HTML response did not include a content-encoding header.',
          'Enable safe compression for text responses where appropriate.',
        ),
      )
    if (!facts.hasOpenGraph)
      findings.push(
        rule(
          page,
          'SEO_OPEN_GRAPH_MISSING',
          AuditFindingCategory.SEO,
          AuditFindingSeverity.LOW,
          'Open Graph metadata is incomplete',
          'No Open Graph metadata was detected.',
          'Add basic Open Graph title, description, and image metadata.',
        ),
      )
    if (!facts.hasTwitterCard)
      findings.push(
        rule(
          page,
          'SEO_TWITTER_CARD_MISSING',
          AuditFindingCategory.SEO,
          AuditFindingSeverity.LOW,
          'Twitter card metadata is incomplete',
          'No Twitter card metadata was detected.',
          'Add Twitter card metadata where social sharing matters.',
        ),
      )
    if (facts.noindex)
      findings.push(
        rule(
          page,
          'SEO_NOINDEX',
          AuditFindingCategory.SEO,
          AuditFindingSeverity.INFO,
          'Page requests no indexing',
          'A robots meta directive includes noindex.',
          'Confirm this page should be excluded from search results.',
        ),
      )
    if (facts.conflictingRobots)
      findings.push(
        rule(
          page,
          'SEO_ROBOTS_CONFLICT',
          AuditFindingCategory.SEO,
          AuditFindingSeverity.MEDIUM,
          'Robots directives conflict',
          'The page contains contradictory index/noindex directives.',
          'Keep one unambiguous indexing directive.',
        ),
      )
    if (!facts.hasCsp)
      findings.push(
        rule(
          page,
          'SECURITY_CSP_MISSING',
          AuditFindingCategory.SECURITY,
          AuditFindingSeverity.LOW,
          'Content Security Policy is missing',
          'No Content-Security-Policy response header was detected.',
          'Define a restrictive CSP appropriate for this application.',
        ),
      )
    if (page.normalizedUrl.startsWith('https:') && !facts.hasHsts)
      findings.push(
        rule(
          page,
          'SECURITY_HSTS_MISSING',
          AuditFindingCategory.SECURITY,
          AuditFindingSeverity.LOW,
          'Strict transport security is missing',
          'The HTTPS response did not include Strict-Transport-Security.',
          'Configure HSTS after confirming all subdomains are ready for HTTPS.',
        ),
      )
    if (!facts.hasXContentTypeOptions)
      findings.push(
        rule(
          page,
          'SECURITY_NOSNIFF_MISSING',
          AuditFindingCategory.SECURITY,
          AuditFindingSeverity.LOW,
          'MIME sniffing protection is missing',
          'The response did not include X-Content-Type-Options: nosniff.',
          'Return X-Content-Type-Options: nosniff.',
        ),
      )
    if (!facts.hasFrameProtection)
      findings.push(
        rule(
          page,
          'SECURITY_FRAME_PROTECTION_MISSING',
          AuditFindingCategory.SECURITY,
          AuditFindingSeverity.LOW,
          'Frame protection is missing',
          'Neither frame-ancestors nor X-Frame-Options was detected.',
          'Set CSP frame-ancestors or X-Frame-Options as appropriate.',
        ),
      )
    if (!facts.hasReferrerPolicy)
      findings.push(
        rule(
          page,
          'SECURITY_REFERRER_POLICY_MISSING',
          AuditFindingCategory.SECURITY,
          AuditFindingSeverity.LOW,
          'Referrer policy is missing',
          'No Referrer-Policy response header was detected.',
          'Set a Referrer-Policy appropriate for the site.',
        ),
      )
    if (facts.mixedContentCount)
      findings.push(
        rule(
          page,
          'SECURITY_MIXED_CONTENT',
          AuditFindingCategory.SECURITY,
          AuditFindingSeverity.MEDIUM,
          'Insecure HTTP resources are referenced',
          `${countText(facts.mixedContentCount)} HTTP resource reference(s) were found on an HTTPS page.`,
          'Serve every resource over HTTPS.',
        ),
      )
    if (facts.unsafeBlankLinkCount)
      findings.push(
        rule(
          page,
          'SECURITY_BLANK_LINK_REL',
          AuditFindingCategory.SECURITY,
          AuditFindingSeverity.LOW,
          'New-tab links lack rel protection',
          `${countText(facts.unsafeBlankLinkCount)} target=_blank link(s) lack noopener or noreferrer.`,
          'Add rel="noopener noreferrer" to links that open a new tab.',
        ),
      )
    if (facts.insecureFormActionCount)
      findings.push(
        rule(
          page,
          'SECURITY_INSECURE_FORM_ACTION',
          AuditFindingCategory.SECURITY,
          AuditFindingSeverity.MEDIUM,
          'Form posts to HTTP',
          `${countText(facts.insecureFormActionCount)} form action(s) use HTTP.`,
          'Submit forms only to HTTPS endpoints.',
        ),
      )
    if (facts.fixedWidthHintCount)
      findings.push(
        rule(
          page,
          'MOBILE_FIXED_WIDTH_HINT',
          AuditFindingCategory.MOBILE,
          AuditFindingSeverity.LOW,
          'Fixed-width layout hint detected',
          'Static markup contains a large fixed-width hint.',
          'Use responsive layout constraints instead of large fixed widths.',
        ),
      )
    if (facts.imageMissingDimensionsCount)
      findings.push(
        rule(
          page,
          'PERF_IMAGE_DIMENSIONS_MISSING',
          AuditFindingCategory.PERFORMANCE,
          AuditFindingSeverity.LOW,
          'Images lack dimensions',
          `${countText(facts.imageMissingDimensionsCount)} image(s) lack width or height attributes.`,
          'Provide intrinsic dimensions or an equivalent reserved aspect ratio.',
        ),
      )
    for (const block of facts.structuredData) {
      if (block.status === AuditStructuredDataStatus.ERROR)
        findings.push(
          rule(
            page,
            'STRUCTURED_DATA_JSONLD_INVALID',
            AuditFindingCategory.STRUCTURED_DATA,
            AuditFindingSeverity.MEDIUM,
            'JSON-LD cannot be parsed',
            'A JSON-LD script block is invalid JSON.',
            'Correct the JSON-LD syntax; scripts are inspected but never executed.',
          ),
        )
      else if (block.status === AuditStructuredDataStatus.WARNING)
        findings.push(
          rule(
            page,
            'STRUCTURED_DATA_INCOMPLETE',
            AuditFindingCategory.STRUCTURED_DATA,
            AuditFindingSeverity.LOW,
            'Structured data is incomplete',
            'A JSON-LD block is missing a valid @context or @type.',
            'Provide a valid schema.org @context and a meaningful @type.',
          ),
        )
    }
    const unsupported = facts.links.filter((link) => link.kind === AuditLinkKind.UNSUPPORTED).length
    if (unsupported)
      findings.push(
        rule(
          page,
          'LINK_UNSUPPORTED_PROTOCOL',
          AuditFindingCategory.BROKEN_LINK,
          AuditFindingSeverity.LOW,
          'Unsupported link protocol',
          `${countText(unsupported)} link(s) use a protocol that is not checked by the audit.`,
          'Use valid HTTP(S) destinations for website links.',
        ),
      )
    if (
      facts.links.filter((link) => link.kind === AuditLinkKind.INTERNAL).length >
      ADVANCED_AUDIT_LIMITS.excessiveInternalLinks
    )
      findings.push(
        rule(
          page,
          'LINK_INTERNAL_COUNT_HIGH',
          AuditFindingCategory.BROKEN_LINK,
          AuditFindingSeverity.LOW,
          'Many internal links',
          'This page has an unusually high number of internal links in the bounded audit.',
          'Review navigation and remove redundant internal links.',
        ),
      )
  }
  for (const [hash, group] of groupBy(pages, (page) => page.analysis.contentHash)) {
    if (!hash || group.length < 2) continue
    for (const page of group)
      findings.push(
        rule(
          page,
          'CONTENT_NEAR_DUPLICATE',
          AuditFindingCategory.CONTENT,
          AuditFindingSeverity.LOW,
          'Duplicate visible content',
          'This page has the same normalized visible-text hash as another crawled page.',
          'Make page-specific content distinct, or consolidate duplicates with a canonical/redirect.',
        ),
      )
  }
  for (const group of groupBy(pages, (page) => page.analysis.h1Text ?? '').values()) {
    if (group.length > 1 && group[0]?.analysis.h1Count)
      for (const page of group)
        findings.push(
          rule(
            page,
            'SEO_H1_DUPLICATE',
            AuditFindingCategory.SEO,
            AuditFindingSeverity.LOW,
            'Primary heading may be duplicated',
            'Multiple pages share the same deterministic H1 marker.',
            'Use page-specific primary headings.',
          ),
        )
  }
  return findings
}

function rule(
  page: AdvancedFindingPage,
  ruleId: string,
  category: AuditFindingCategory,
  severity: AuditFindingSeverity,
  title: string,
  description: string,
  recommendationTemplate: string,
): DeterministicFinding {
  return {
    pageId: page.id,
    category,
    ruleId,
    severity,
    title,
    description,
    evidence: { pageUrl: page.normalizedUrl },
    recommendationTemplate,
    fingerprint: createHash('sha256').update(`${ruleId}:${page.normalizedUrl}`).digest('hex'),
  }
}

function collectLinks(html: string, page: URL): AnalysedLink[] {
  const links: AnalysedLink[] = []
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>|<a\b([^>]*)\/?\s*>/gi)) {
    if (links.length >= ADVANCED_AUDIT_LIMITS.maxLinksPerPage) break
    const attrs = readAttributes(match[1] ?? match[3] ?? '')
    const href = attrs.href?.trim()
    const anchorText = normalizeText(visibleText(match[2] ?? '')).slice(
      0,
      ADVANCED_AUDIT_LIMITS.maxAnchorLength,
    )
    if (!href) {
      links.push({
        destinationUrl: '',
        kind: AuditLinkKind.MALFORMED,
        status: AuditLinkStatus.FAILED,
        failureCode: 'LINK_HREF_MISSING',
        ...(anchorText ? { anchorText } : {}),
      })
      continue
    }
    try {
      const destination = new URL(href, page)
      if (destination.protocol !== 'http:' && destination.protocol !== 'https:') {
        links.push({
          destinationUrl: href,
          kind: AuditLinkKind.UNSUPPORTED,
          status: AuditLinkStatus.UNCHECKED,
          ...(anchorText ? { anchorText } : {}),
        })
        continue
      }
      destination.hash = ''
      links.push({
        destinationUrl: destination.toString(),
        kind:
          destination.hostname === page.hostname ? AuditLinkKind.INTERNAL : AuditLinkKind.EXTERNAL,
        status: AuditLinkStatus.UNCHECKED,
        ...(anchorText ? { anchorText } : {}),
      })
    } catch {
      links.push({
        destinationUrl: href.slice(0, 2048),
        kind: AuditLinkKind.MALFORMED,
        status: AuditLinkStatus.FAILED,
        failureCode: 'LINK_URL_INVALID',
        ...(anchorText ? { anchorText } : {}),
      })
    }
  }
  return links
}

function parseStructuredData(html: string, page: URL): StructuredDataBlock[] {
  const blocks: StructuredDataBlock[] = []
  for (const [index, match] of [
    ...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi),
  ].entries()) {
    if (blocks.length >= ADVANCED_AUDIT_LIMITS.maxJsonLdBlocks) break
    const attrs = readAttributes(match[1] ?? '')
    if ((attrs.type ?? '').toLowerCase() !== 'application/ld+json') continue
    try {
      const parsed: unknown = JSON.parse(match[2] ?? '')
      const records = Array.isArray(parsed) ? parsed : [parsed]
      if (
        !records.every((record) => record && typeof record === 'object' && !Array.isArray(record))
      ) {
        blocks.push({
          blockIndex: index,
          status: AuditStructuredDataStatus.UNSUPPORTED,
          types: [],
          summary: { reason: 'object_shape_unsupported' },
        })
        continue
      }
      const objects = records as Record<string, unknown>[]
      const types = objects.flatMap((record) =>
        Array.isArray(record['@type'])
          ? record['@type'].filter((value): value is string => typeof value === 'string')
          : typeof record['@type'] === 'string'
            ? [record['@type']]
            : [],
      )
      const context = objects.find((record) => typeof record['@context'] === 'string')?.[
        '@context'
      ] as string | undefined
      const externalUrl = objects.some((record) =>
        Object.values(record).some(
          (value) =>
            typeof value === 'string' &&
            /^https?:/i.test(value) &&
            safeHost(value) !== page.hostname,
        ),
      )
      blocks.push({
        blockIndex: index,
        status:
          context === 'https://schema.org' || context === 'http://schema.org'
            ? types.length
              ? AuditStructuredDataStatus.VALID
              : AuditStructuredDataStatus.WARNING
            : AuditStructuredDataStatus.WARNING,
        types: [...new Set(types)].slice(0, 20),
        ...(context ? { context } : {}),
        summary: { recordCount: objects.length, externalUrl },
      })
    } catch {
      blocks.push({
        blockIndex: index,
        status: AuditStructuredDataStatus.ERROR,
        types: [],
        summary: { reason: 'invalid_json' },
      })
    }
  }
  return blocks
}

function safeHost(value: string): string | undefined {
  try {
    return new URL(value).hostname
  } catch {
    return undefined
  }
}
function lowerCaseHeaders(
  headers: AnalysePageInput['responseHeaders'],
): Record<string, string | string[] | undefined> {
  return Object.fromEntries(
    Object.entries(headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]),
  )
}
function readAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  for (const match of tag.matchAll(
    /([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g,
  )) {
    const key = match[1]?.toLowerCase()
    if (
      key &&
      key !== 'a' &&
      key !== 'img' &&
      key !== 'meta' &&
      key !== 'link' &&
      key !== 'script' &&
      key !== 'input' &&
      key !== 'button' &&
      key !== 'form' &&
      key !== 'iframe' &&
      key !== 'html' &&
      key !== 'main'
    )
      attrs[key] = match[2] ?? match[3] ?? match[4] ?? ''
  }
  return attrs
}
function visibleText(html: string): string {
  return decode(
    html.replace(
      /<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>|<[^>]+>/gi,
      ' ',
    ),
  )
}
function decode(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}
function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase()
}
function addOrigin(origins: Set<string>, value: string | undefined, page: URL): void {
  if (!value) return
  try {
    const url = new URL(value, page)
    if (url.hostname !== page.hostname) origins.add(url.origin)
  } catch {}
}
function metaContent(html: string, name: string): string | undefined {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = readAttributes(match[0])
    if ((attrs.name ?? '').toLowerCase() === name) return attrs.content
  }
  return undefined
}
function robotsHas(html: string, directive: string): boolean {
  return [...html.matchAll(/<meta\b[^>]*>/gi)].some((match) => {
    const attrs = readAttributes(match[0])
    return (
      (attrs.name ?? '').toLowerCase() === 'robots' &&
      (attrs.content ?? '')
        .toLowerCase()
        .split(/[\s,]+/)
        .includes(directive)
    )
  })
}
function controlsWithoutLabels(html: string): { unlabeled: number; unnamedButtons: number } {
  let unlabeled = 0
  let unnamedButtons = 0
  for (const match of html.matchAll(
    /<(input|select|textarea|button)\b([^>]*)>([\s\S]*?<\/button>)?/gi,
  )) {
    const tag = match[1]?.toLowerCase()
    const attrs = readAttributes(match[2] ?? '')
    const text = normalizeText(visibleText(match[3] ?? ''))
    if (tag === 'button') {
      if (!text && !attrs['aria-label'] && !attrs.title) unnamedButtons += 1
    } else if (
      (attrs.type ?? '').toLowerCase() !== 'hidden' &&
      !attrs['aria-label'] &&
      !attrs['aria-labelledby'] &&
      !(
        attrs.id &&
        new RegExp(`<label\\b[^>]*\\bfor\\s*=\\s*(["'])${escapeRegExp(attrs.id)}\\1`, 'i').test(
          html,
        )
      )
    )
      unlabeled += 1
  }
  return { unlabeled, unnamedButtons }
}
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
function skipsHeadingLevel(levels: number[]): boolean {
  return levels.some((level, index) => index > 0 && level > (levels[index - 1] ?? 0) + 1)
}
function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const value = key(item)
    if (value) groups.set(value, [...(groups.get(value) ?? []), item])
  }
  return groups
}
function countText(value: number): string {
  return String(value)
}
function countMixedContent(html: string, page: URL): number {
  return page.protocol === 'https:'
    ? (html.match(/(?:src|href|action)\s*=\s*(["'])http:\/\//gi) ?? []).length
    : 0
}
function countUnsafeBlankLinks(html: string): number {
  let total = 0
  for (const match of html.matchAll(/<a\b[^>]*>/gi)) {
    const attrs = readAttributes(match[0])
    if (attrs.target === '_blank' && !/(^|\s)(noopener|noreferrer)(\s|$)/.test(attrs.rel ?? ''))
      total += 1
  }
  return total
}
function countInsecureFormActions(html: string, page: URL): number {
  if (page.protocol !== 'https:') return 0
  let total = 0
  for (const match of html.matchAll(/<form\b[^>]*>/gi)) {
    if ((readAttributes(match[0]).action ?? '').startsWith('http:')) total += 1
  }
  return total
}
