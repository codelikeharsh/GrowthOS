import { HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { getDatabaseClient, OrganizationType, type Prisma } from '@growthos/db'
import { AgencyClientService } from './agency-client.service.js'
import { DomainError } from './domain-error.js'
import { PermissionService } from './permission.service.js'
import { normalizeWebsiteUrl } from './phase3-domain.js'
import type { CreateWebsiteDto, UpdateWebsiteDto } from './phase3.dto.js'
import type { RequestMetadata } from './request-context.js'

export interface WebsiteContextHeaders {
  businessId?: string
  agencyId?: string
  relationshipId?: string
}

export const websitePermissions = {
  read: 'website.read',
  manage: 'website.manage',
} as const

@Injectable()
export class WebsiteService {
  private readonly database = getDatabaseClient()

  constructor(
    @Inject(PermissionService) private readonly permissions: PermissionService,
    @Inject(AgencyClientService) private readonly clients: AgencyClientService,
  ) {}

  async list(userId: string, headers: WebsiteContextHeaders) {
    const businessId = await this.resolve(userId, headers, websitePermissions.read, false)
    return this.database.website.findMany({
      where: { businessOrganizationId: businessId },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
      take: 100,
    })
  }

  async get(userId: string, headers: WebsiteContextHeaders, websiteId: string) {
    const businessId = await this.resolve(userId, headers, websitePermissions.read, false)
    const website = await this.database.website.findFirst({
      where: { id: websiteId, businessOrganizationId: businessId },
    })
    if (!website) throw new NotFoundException('Website not found')
    return website
  }

  async create(
    userId: string,
    headers: WebsiteContextHeaders,
    input: CreateWebsiteDto,
    request: RequestMetadata,
  ) {
    const businessId = await this.resolve(userId, headers, websitePermissions.manage, true)
    const normalizedUrl = this.normalized(input.url)
    try {
      const website = await this.database.website.create({
        data: {
          businessOrganizationId: businessId,
          displayName: this.displayName(input.displayName),
          url: normalizedUrl,
          normalizedUrl,
        },
      })
      await this.audit('website.registered', userId, businessId, website.id, request)
      return website
    } catch (cause) {
      if (this.isUniqueViolation(cause))
        throw new DomainError(
          'WEBSITE_ALREADY_REGISTERED',
          'This website is already registered for the business',
          HttpStatus.CONFLICT,
        )
      throw cause
    }
  }

  async update(
    userId: string,
    headers: WebsiteContextHeaders,
    websiteId: string,
    input: UpdateWebsiteDto,
    request: RequestMetadata,
  ) {
    const businessId = await this.resolve(userId, headers, websitePermissions.manage, true)
    const { version, url, displayName } = input
    const normalizedUrl = url === undefined ? undefined : this.normalized(url)
    try {
      const updated = await this.database.website.updateMany({
        where: { id: websiteId, businessOrganizationId: businessId, version },
        data: {
          ...(displayName !== undefined ? { displayName: this.displayName(displayName) } : {}),
          ...(normalizedUrl ? { url: normalizedUrl, normalizedUrl } : {}),
          version: { increment: 1 },
        },
      })
      if (!updated.count) await this.notFoundOrConflict(websiteId, businessId)
    } catch (cause) {
      if (this.isUniqueViolation(cause))
        throw new DomainError(
          'WEBSITE_ALREADY_REGISTERED',
          'This website is already registered for the business',
          HttpStatus.CONFLICT,
        )
      throw cause
    }
    await this.audit('website.updated', userId, businessId, websiteId, request)
    return this.get(userId, headers, websiteId)
  }

  async disable(
    userId: string,
    headers: WebsiteContextHeaders,
    websiteId: string,
    request: RequestMetadata,
  ) {
    const businessId = await this.resolve(userId, headers, websitePermissions.manage, true)
    const updated = await this.database.website.updateMany({
      where: { id: websiteId, businessOrganizationId: businessId, isActive: true },
      data: { isActive: false, version: { increment: 1 } },
    })
    if (!updated.count) {
      const exists = await this.database.website.count({
        where: { id: websiteId, businessOrganizationId: businessId },
      })
      if (!exists) throw new NotFoundException('Website not found')
    }
    await this.audit('website.disabled', userId, businessId, websiteId, request)
    return { disabled: true }
  }

  private async resolve(
    userId: string,
    headers: WebsiteContextHeaders,
    permission: string,
    writable: boolean,
  ): Promise<string> {
    if (headers.businessId) {
      await this.permissions.requireType(
        userId,
        headers.businessId,
        OrganizationType.BUSINESS,
        permission,
      )
      return headers.businessId
    }
    if (!headers.agencyId || !headers.relationshipId)
      throw new DomainError('BUSINESS_REQUIRED', 'A permitted business context is required', 400)
    const { relationship } = await this.clients.requireAgencyRelationship(
      userId,
      headers.agencyId,
      headers.relationshipId,
      permission,
      writable,
    )
    return relationship.businessOrganizationId
  }

  private normalized(input: string): string {
    try {
      return normalizeWebsiteUrl(input)
    } catch (cause) {
      throw new DomainError(
        'INVALID_WEBSITE_URL',
        cause instanceof Error ? cause.message : 'Website URL is invalid',
        HttpStatus.BAD_REQUEST,
      )
    }
  }

  private displayName(value: string | undefined): string | null {
    const normalized = value?.trim()
    return normalized === undefined || normalized === '' ? null : normalized
  }

  private async notFoundOrConflict(websiteId: string, businessId: string): Promise<never> {
    const exists = await this.database.website.count({
      where: { id: websiteId, businessOrganizationId: businessId },
    })
    if (!exists) throw new NotFoundException('Website not found')
    throw new DomainError(
      'OPTIMISTIC_CONCURRENCY_CONFLICT',
      'The record changed; reload and try again',
      HttpStatus.CONFLICT,
    )
  }

  private isUniqueViolation(cause: unknown): boolean {
    return typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 'P2002'
  }

  private async audit(
    action: string,
    actorUserId: string,
    organizationId: string,
    targetId: string,
    request: RequestMetadata,
  ): Promise<void> {
    await this.database.auditLog.create({
      data: {
        action,
        actor: { connect: { id: actorUserId } },
        organization: { connect: { id: organizationId } },
        targetType: 'website',
        targetId,
        requestId: request.requestId,
        ipAddress: request.ipAddress,
      } satisfies Prisma.AuditLogCreateInput,
    })
  }
}
