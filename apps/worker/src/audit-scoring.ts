import { AuditFindingCategory } from '@growthos/db'
import type { AuditFindingSeverity } from '@growthos/db'

export const SCORING_VERSION = 'phase-5-v1'

const penalties: Record<AuditFindingSeverity, number> = {
  INFO: 0,
  LOW: 2,
  MEDIUM: 6,
  HIGH: 14,
  CRITICAL: 28,
}

export interface ScoreFinding {
  category: AuditFindingCategory
  severity: AuditFindingSeverity
}

export interface CategoryScore {
  category: 'SEO' | 'ACCESSIBILITY' | 'PERFORMANCE' | 'BEST_PRACTICES' | 'OVERALL'
  score: number
  findingCount: number
  explanation: { penalties: number; severityCounts: Record<AuditFindingSeverity, number> }
}

/**
 * Transparent bounded scoring. Each observed finding contributes a documented
 * severity penalty; scores are always clamped between 0 and 100. Provider
 * scores are intentionally excluded until an optional provider returns real
 * data under its own labelled source.
 */
export function scoreAudit(findings: ScoreFinding[]): CategoryScore[] {
  const buckets: Record<CategoryScore['category'], ScoreFinding[]> = {
    SEO: [],
    ACCESSIBILITY: [],
    PERFORMANCE: [],
    BEST_PRACTICES: [],
    OVERALL: findings,
  }
  for (const finding of findings) {
    if (
      finding.category === AuditFindingCategory.SEO ||
      finding.category === AuditFindingCategory.CONTENT
    )
      buckets.SEO.push(finding)
    else if (finding.category === AuditFindingCategory.ACCESSIBILITY)
      buckets.ACCESSIBILITY.push(finding)
    else if (finding.category === AuditFindingCategory.PERFORMANCE)
      buckets.PERFORMANCE.push(finding)
    else if (
      finding.category === AuditFindingCategory.SECURITY ||
      finding.category === AuditFindingCategory.MOBILE ||
      finding.category === AuditFindingCategory.STRUCTURED_DATA ||
      finding.category === AuditFindingCategory.TECHNICAL
    )
      buckets.BEST_PRACTICES.push(finding)
    else buckets.BEST_PRACTICES.push(finding)
  }
  return (Object.keys(buckets) as CategoryScore['category'][]).map((category) => {
    const bucket = buckets[category]
    const severityCounts: Record<AuditFindingSeverity, number> = {
      INFO: 0,
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    }
    for (const finding of bucket) severityCounts[finding.severity] += 1
    const totalPenalty = bucket.reduce((sum, finding) => sum + penalties[finding.severity], 0)
    return {
      category,
      score: Math.max(0, Math.min(100, 100 - totalPenalty)),
      findingCount: bucket.length,
      explanation: { penalties: totalPenalty, severityCounts },
    }
  })
}
