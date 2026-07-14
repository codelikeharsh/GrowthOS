import { SCORING_VERSION, type CategoryScore } from './audit-scoring.js'

export interface FingerprintedFinding {
  fingerprint: string
  severity: string
}

export function compareAuditRuns(input: {
  currentFindings: FingerprintedFinding[]
  previousFindings?: FingerprintedFinding[]
  currentPageCount: number
  previousPageCount?: number
  currentScores: CategoryScore[]
  previousScores?: { category: string; score: number }[]
}) {
  if (!input.previousFindings)
    return {
      scoringVersion: SCORING_VERSION,
      newFindings: 0,
      resolvedFindings: 0,
      unchangedFindings: 0,
      pageCountChange: undefined,
      overallScoreChange: undefined,
      details: { available: false, reason: 'no_previous_completed_audit' },
    }
  const previous = new Map(input.previousFindings.map((finding) => [finding.fingerprint, finding]))
  const current = new Map(input.currentFindings.map((finding) => [finding.fingerprint, finding]))
  let unchangedFindings = 0
  for (const fingerprint of current.keys()) if (previous.has(fingerprint)) unchangedFindings += 1
  const currentOverall = input.currentScores.find((score) => score.category === 'OVERALL')?.score
  const previousOverall = input.previousScores?.find((score) => score.category === 'OVERALL')?.score
  return {
    scoringVersion: SCORING_VERSION,
    newFindings: [...current.keys()].filter((fingerprint) => !previous.has(fingerprint)).length,
    resolvedFindings: [...previous.keys()].filter((fingerprint) => !current.has(fingerprint))
      .length,
    unchangedFindings,
    ...(input.previousPageCount === undefined
      ? {}
      : { pageCountChange: input.currentPageCount - input.previousPageCount }),
    ...(currentOverall === undefined || previousOverall === undefined
      ? {}
      : { overallScoreChange: currentOverall - previousOverall }),
    details: {
      available: true,
      categoryScoreChanges: input.currentScores
        .filter((score) => score.category !== 'OVERALL')
        .map((score) => ({
          category: score.category,
          change:
            score.score -
            (input.previousScores?.find(
              (previousScore) => previousScore.category === score.category,
            )?.score ?? score.score),
        })),
    },
  }
}
