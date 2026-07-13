import { auditOrchestrationJobName, type AuditOrchestrationPayload } from '@growthos/config'
import {
  ConflictException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { AuditRunStatus, AuditTriggerType, getDatabaseClient, type AuditRun } from '@growthos/db'
import { canCancelAudit } from './audit-domain.js'
import { AuditOutboxDispatcher } from './audit-outbox.service.js'
import { DomainError } from './domain-error.js'
import type { CreateAuditDto, ListAuditsDto } from './phase3.dto.js'
import type { RequestMetadata } from './request-context.js'
import { WebsiteService, type WebsiteContextHeaders } from './website.service.js'

const permissions = {
  create: 'website.audit.create',
  read: 'website.audit.read',
  cancel: 'website.audit.cancel',
} as const

@Injectable()
export class AuditRunService {
  private readonly database = getDatabaseClient()
  constructor(
    @Inject(WebsiteService) private readonly websites: WebsiteService,
    @Inject(AuditOutboxDispatcher) private readonly outbox: AuditOutboxDispatcher,
  ) {}

  async create(
    userId: string,
    headers: WebsiteContextHeaders,
    websiteId: string,
    input: CreateAuditDto,
    key: string | undefined,
    request: RequestMetadata,
  ) {
    const organizationId = await this.websites.authorize(userId, headers, permissions.create, true)
    const website = await this.website(websiteId, organizationId)
    if (!website.isActive)
      throw new DomainError('AUDIT_WEBSITE_DISABLED', 'Website is disabled', HttpStatus.CONFLICT)
    if (key && (key.length < 8 || key.length > 128))
      throw new DomainError('AUDIT_IDEMPOTENCY_CONFLICT', 'Idempotency key is invalid', 400)
    if (key) {
      const existing = await this.database.auditRun.findUnique({
        where: { websiteId_idempotencyKey: { websiteId, idempotencyKey: key } },
      })
      if (existing) return existing
    }
    const active = await this.database.auditRun.findFirst({
      where: { websiteId, status: { in: [...activeStatuses] } },
    })
    if (active)
      throw new DomainError(
        'AUDIT_ALREADY_ACTIVE',
        'An audit is already active for this website',
        HttpStatus.CONFLICT,
      )
    let created: { audit: AuditRun; eventId: string }
    try {
      created = await this.database.$transaction(async (transaction) => {
        const previous = await transaction.auditRun.findFirst({
          where: { websiteId },
          orderBy: { createdAt: 'desc' },
        })
        const audit = await transaction.auditRun.create({
          data: {
            organizationId,
            websiteId,
            initiatedByUserId: userId,
            triggerType: input.triggerType ?? AuditTriggerType.MANUAL,
            ...(key ? { idempotencyKey: key } : {}),
            ...(previous ? { previousAuditRunId: previous.id } : {}),
          },
        })
        const payload: AuditOrchestrationPayload = {
          auditRunId: audit.id,
          websiteId,
          organizationId,
        }
        const event = await transaction.outboxEvent.create({
          data: {
            organizationId,
            auditRunId: audit.id,
            eventType: auditOrchestrationJobName,
            payload: { ...payload },
          },
        })
        await transaction.auditLog.create({
          data: {
            action: 'audit.requested',
            actorUserId: userId,
            organizationId,
            targetType: 'audit_run',
            targetId: audit.id,
            requestId: request.requestId,
            ipAddress: request.ipAddress,
          },
        })
        return { audit, eventId: event.id }
      })
    } catch (cause) {
      if (this.isUniqueViolation(cause))
        throw new DomainError(
          'AUDIT_ALREADY_ACTIVE',
          'An audit is already active for this website',
          HttpStatus.CONFLICT,
        )
      throw cause
    }
    await this.outbox.dispatch(created.eventId)
    return created.audit
  }

  async list(
    userId: string,
    headers: WebsiteContextHeaders,
    websiteId: string,
    query: ListAuditsDto,
  ) {
    const organizationId = await this.websites.authorize(userId, headers, permissions.read, false)
    await this.website(websiteId, organizationId)
    const limit = Number.isFinite(query.limit) ? Math.min(Math.max(query.limit, 1), 50) : 20
    const audits = await this.database.auditRun.findMany({
      where: { websiteId, organizationId, ...(query.cursor ? { id: { lt: query.cursor } } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    })
    return {
      audits: audits.slice(0, limit),
      nextCursor: audits.length > limit ? audits[limit - 1]?.id : undefined,
    }
  }

  async get(userId: string, headers: WebsiteContextHeaders, websiteId: string, auditId: string) {
    const organizationId = await this.websites.authorize(userId, headers, permissions.read, false)
    const audit = await this.database.auditRun.findFirst({
      where: { id: auditId, websiteId, organizationId },
    })
    if (!audit) throw new DomainError('AUDIT_NOT_FOUND', 'Audit not found', HttpStatus.NOT_FOUND)
    return audit
  }

  async findings(
    userId: string,
    headers: WebsiteContextHeaders,
    websiteId: string,
    auditId: string,
    filters: {
      severity?: string
      category?: string
      ruleId?: string
      pageId?: string
      limit?: number
    },
  ) {
    await this.get(userId, headers, websiteId, auditId)
    return this.database.auditFinding.findMany({
      where: {
        auditRunId: auditId,
        ...(filters.severity ? { severity: filters.severity as never } : {}),
        ...(filters.category ? { category: filters.category as never } : {}),
        ...(filters.ruleId ? { ruleId: filters.ruleId } : {}),
        ...(filters.pageId ? { auditPageId: filters.pageId } : {}),
      },
      include: { auditPage: { select: { normalizedUrl: true } } },
      orderBy: [{ severity: 'desc' }, { createdAt: 'asc' }],
      take: Math.min(Math.max(filters.limit ?? 50, 1), 50),
    })
  }

  async cancel(
    userId: string,
    headers: WebsiteContextHeaders,
    websiteId: string,
    auditId: string,
    request: RequestMetadata,
  ) {
    const organizationId = await this.websites.authorize(userId, headers, permissions.cancel, true)
    const audit = await this.get(userId, headers, websiteId, auditId)
    if (!canCancelAudit(audit.status))
      throw new DomainError(
        'AUDIT_CANCEL_NOT_ALLOWED',
        'Audit cannot be cancelled',
        HttpStatus.CONFLICT,
      )
    const updated = await this.database.auditRun.updateMany({
      where: { id: auditId, status: AuditRunStatus.QUEUED },
      data: {
        status: AuditRunStatus.CANCELLED,
        completedAt: new Date(),
        version: { increment: 1 },
      },
    })
    if (!updated.count) throw new ConflictException('AUDIT_INVALID_TRANSITION')
    await this.database.auditLog.create({
      data: {
        action: 'audit.cancelled',
        actorUserId: userId,
        organizationId,
        targetType: 'audit_run',
        targetId: auditId,
        requestId: request.requestId,
        ipAddress: request.ipAddress,
      },
    })
    return this.get(userId, headers, websiteId, auditId)
  }

  private async website(id: string, organizationId: string) {
    const website = await this.database.website.findFirst({
      where: { id, businessOrganizationId: organizationId },
    })
    if (!website) throw new NotFoundException('Website not found')
    return website
  }
  private isUniqueViolation(cause: unknown): boolean {
    return typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 'P2002'
  }
}

const activeStatuses = new Set<AuditRunStatus>([
  AuditRunStatus.QUEUED,
  AuditRunStatus.VALIDATING_TARGET,
  AuditRunStatus.CRAWLING,
  AuditRunStatus.ANALYZING,
  AuditRunStatus.GENERATING_RECOMMENDATIONS,
])
