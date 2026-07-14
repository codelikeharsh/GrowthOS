import { describe, expect, it } from 'vitest'
import { AuditFindingCategory, AuditLinkKind, AuditStructuredDataStatus } from '@growthos/db'
import { analysePageHtml, evaluateAdvancedFindings } from './advanced-analysis.js'
import { compareAuditRuns } from './audit-comparison.js'
import { scoreAudit } from './audit-scoring.js'

describe('bounded advanced static analysis', () => {
  it('extracts deterministic accessibility, security, link, and JSON-LD facts without fetching', () => {
    const analysis = analysePageHtml({
      pageUrl: 'https://example.test/',
      html: `<!doctype html><html><head><title>Short</title><script type="application/ld+json">{oops}</script></head><body><img src="/logo.png"><button></button><a href="https://outside.test" target="_blank"> </a><a href="javascript:alert(1)">bad</a><input type="text"><h1>First</h1><h3>Skipped</h3></body></html>`,
      responseHeaders: {},
    })
    expect(analysis.htmlLang).toBeUndefined()
    expect(analysis.imageMissingAltCount).toBe(1)
    expect(analysis.unnamedButtonCount).toBe(1)
    expect(analysis.unlabeledControlCount).toBe(1)
    expect(analysis.links.some((link) => link.kind === AuditLinkKind.EXTERNAL)).toBe(true)
    expect(analysis.links.some((link) => link.kind === AuditLinkKind.UNSUPPORTED)).toBe(true)
    expect(analysis.structuredData[0]?.status).toBe(AuditStructuredDataStatus.ERROR)

    const findings = evaluateAdvancedFindings([
      { id: 'page-1', normalizedUrl: 'https://example.test/', analysis },
    ])
    expect(
      findings.some((finding) => finding.category === AuditFindingCategory.ACCESSIBILITY),
    ).toBe(true)
    expect(findings.some((finding) => finding.ruleId === 'SECURITY_CSP_MISSING')).toBe(true)
    expect(findings.some((finding) => finding.ruleId === 'STRUCTURED_DATA_JSONLD_INVALID')).toBe(
      true,
    )
  })

  it('keeps scores bounded and makes the formula inspectable', () => {
    const scores = scoreAudit([
      { category: AuditFindingCategory.SEO, severity: 'CRITICAL' },
      { category: AuditFindingCategory.SEO, severity: 'CRITICAL' },
      { category: AuditFindingCategory.ACCESSIBILITY, severity: 'LOW' },
    ])
    expect(scores.find((score) => score.category === 'SEO')?.score).toBe(44)
    expect(scores.find((score) => score.category === 'OVERALL')?.score).toBeGreaterThanOrEqual(0)
  })

  it('compares stable fingerprints only when a compatible predecessor exists', () => {
    const result = compareAuditRuns({
      currentFindings: [
        { fingerprint: 'same', severity: 'LOW' },
        { fingerprint: 'new', severity: 'HIGH' },
      ],
      previousFindings: [
        { fingerprint: 'same', severity: 'LOW' },
        { fingerprint: 'resolved', severity: 'MEDIUM' },
      ],
      currentPageCount: 3,
      previousPageCount: 2,
      currentScores: scoreAudit([]),
      previousScores: [{ category: 'OVERALL', score: 90 }],
    })
    expect(result.newFindings).toBe(1)
    expect(result.resolvedFindings).toBe(1)
    expect(result.unchangedFindings).toBe(1)
    expect(result.pageCountChange).toBe(1)
  })
})
