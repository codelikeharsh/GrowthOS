import { AuditRunStatus } from '@growthos/db'

const active = new Set<AuditRunStatus>([
  AuditRunStatus.QUEUED,
  AuditRunStatus.VALIDATING_TARGET,
  AuditRunStatus.CRAWLING,
  AuditRunStatus.ANALYZING,
  AuditRunStatus.GENERATING_RECOMMENDATIONS,
])

export function isActiveAuditStatus(status: AuditRunStatus): boolean {
  return active.has(status)
}

export function canCancelAudit(status: AuditRunStatus): boolean {
  return status === AuditRunStatus.QUEUED
}

export function canTransitionAudit(from: AuditRunStatus, to: AuditRunStatus): boolean {
  if (from === AuditRunStatus.QUEUED)
    return (
      to === AuditRunStatus.VALIDATING_TARGET ||
      to === AuditRunStatus.CANCELLED ||
      to === AuditRunStatus.FAILED
    )
  if (from === AuditRunStatus.VALIDATING_TARGET)
    return (
      to === AuditRunStatus.CRAWLING ||
      to === AuditRunStatus.FAILED ||
      to === AuditRunStatus.CANCELLED
    )
  if (from === AuditRunStatus.CRAWLING)
    return (
      [
        AuditRunStatus.ANALYZING,
        AuditRunStatus.PARTIAL,
        AuditRunStatus.FAILED,
        AuditRunStatus.CANCELLED,
      ] as AuditRunStatus[]
    ).includes(to)
  if (from === AuditRunStatus.ANALYZING)
    return (
      [
        AuditRunStatus.GENERATING_RECOMMENDATIONS,
        AuditRunStatus.PARTIAL,
        AuditRunStatus.FAILED,
        AuditRunStatus.CANCELLED,
      ] as AuditRunStatus[]
    ).includes(to)
  if (from === AuditRunStatus.GENERATING_RECOMMENDATIONS)
    return (
      [AuditRunStatus.COMPLETED, AuditRunStatus.PARTIAL, AuditRunStatus.FAILED] as AuditRunStatus[]
    ).includes(to)
  return false
}
