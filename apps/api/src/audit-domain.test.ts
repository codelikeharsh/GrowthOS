import { AuditRunStatus } from '@growthos/db'
import { describe, expect, it } from 'vitest'
import { canCancelAudit, canTransitionAudit, isActiveAuditStatus } from './audit-domain.js'

describe('audit lifecycle', () => {
  it('classifies only in-flight audit statuses as active', () => {
    expect(isActiveAuditStatus(AuditRunStatus.QUEUED)).toBe(true)
    expect(isActiveAuditStatus(AuditRunStatus.CANCELLED)).toBe(false)
    expect(isActiveAuditStatus(AuditRunStatus.COMPLETED)).toBe(false)
  })
  it('allows cancellation only while queued', () => {
    expect(canCancelAudit(AuditRunStatus.QUEUED)).toBe(true)
    expect(canCancelAudit(AuditRunStatus.FAILED)).toBe(false)
  })
  it('defines the bounded homepage worker transitions', () => {
    expect(canTransitionAudit(AuditRunStatus.QUEUED, AuditRunStatus.CANCELLED)).toBe(true)
    expect(canTransitionAudit(AuditRunStatus.QUEUED, AuditRunStatus.VALIDATING_TARGET)).toBe(true)
    expect(canTransitionAudit(AuditRunStatus.VALIDATING_TARGET, AuditRunStatus.CRAWLING)).toBe(true)
    expect(canTransitionAudit(AuditRunStatus.CRAWLING, AuditRunStatus.ANALYZING)).toBe(true)
    expect(canTransitionAudit(AuditRunStatus.QUEUED, AuditRunStatus.COMPLETED)).toBe(false)
    expect(canTransitionAudit(AuditRunStatus.COMPLETED, AuditRunStatus.CANCELLED)).toBe(false)
  })
})
