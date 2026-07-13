import { HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common'
import {
  AgencyClientNoteVisibility,
  AgencyClientRelationshipStatus,
  getDatabaseClient,
  OrganizationType,
  type Prisma,
} from '@growthos/db'
import { AgencyClientService, phase3Permissions } from './agency-client.service.js'
import { DomainError } from './domain-error.js'
import { PermissionService } from './permission.service.js'
import {
  type CreateLocationDto,
  type CreateServiceDto,
  type CreateSocialLinkDto,
  type ReplaceBusinessHoursDto,
  type UpdateBusinessProfileDto,
  type UpdateLocationDto,
  type UpdateServiceDto,
  type UpdateSocialLinkDto,
} from './phase3.dto.js'
import {
  hasHourOverlap,
  isValidCurrency,
  isValidTimezone,
  normalizeSocialUrl,
  validatePrice,
} from './phase3-domain.js'
import type { RequestMetadata } from './request-context.js'
import { slugifyOrganizationName } from './security.js'

export interface BusinessContextHeaders {
  businessId?: string
  agencyId?: string
  relationshipId?: string
}

const businessPermissions = {
  profileRead: 'business_profile.read',
  profileUpdate: 'business_profile.update',
  locationRead: 'business_location.read',
  locationManage: 'business_location.manage',
  serviceRead: 'business_service.read',
  serviceManage: 'business_service.manage',
  hoursRead: 'business_hours.read',
  hoursManage: 'business_hours.manage',
  socialRead: 'business_social_link.read',
  socialManage: 'business_social_link.manage',
} as const

@Injectable()
export class BusinessProfileService {
  private readonly database = getDatabaseClient()

  constructor(
    @Inject(PermissionService) private readonly permissions: PermissionService,
    @Inject(AgencyClientService) private readonly clients: AgencyClientService,
  ) {}

  async getProfile(userId: string, headers: BusinessContextHeaders) {
    const businessId = await this.resolve(userId, headers, businessPermissions.profileRead, false)
    const profile = await this.database.businessProfile.findUnique({
      where: { organizationId: businessId },
    })
    if (!profile)
      throw new DomainError(
        'BUSINESS_PROFILE_NOT_FOUND',
        'Business profile not found',
        HttpStatus.NOT_FOUND,
      )
    return profile
  }

  async updateProfile(
    userId: string,
    headers: BusinessContextHeaders,
    input: UpdateBusinessProfileDto,
    request: RequestMetadata,
  ) {
    const businessId = await this.resolve(userId, headers, businessPermissions.profileUpdate, true)
    if (input.timezone && !isValidTimezone(input.timezone))
      throw new DomainError('INVALID_TIMEZONE', 'Timezone must be a valid IANA identifier', 400)
    if (input.currency && !isValidCurrency(input.currency))
      throw new DomainError('INVALID_CURRENCY', 'Currency code is not supported', 400)
    const { version, ...fields } = input
    const updated = await this.database.businessProfile.updateMany({
      where: { organizationId: businessId, version },
      data: { ...fields, version: { increment: 1 } },
    })
    if (!updated.count) this.concurrencyError()
    await this.audit('business_profile.updated', userId, businessId, businessId, request, {
      fields: Object.keys(fields),
    })
    return this.getProfile(userId, headers)
  }

  async listLocations(userId: string, headers: BusinessContextHeaders) {
    const businessId = await this.resolve(userId, headers, businessPermissions.locationRead, false)
    return this.database.businessLocation.findMany({
      where: { businessOrganizationId: businessId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      take: 100,
    })
  }

  async createLocation(
    userId: string,
    headers: BusinessContextHeaders,
    input: CreateLocationDto,
    request: RequestMetadata,
  ) {
    const businessId = await this.resolve(userId, headers, businessPermissions.locationManage, true)
    try {
      const location = await this.database.businessLocation.create({
        data: {
          businessOrganizationId: businessId,
          name: input.name,
          locationType: input.locationType,
          countryCode: input.countryCode,
          isPrimary: input.isPrimary ?? false,
          ...(input.addressLine1 ? { addressLine1: input.addressLine1 } : {}),
          ...(input.addressLine2 ? { addressLine2: input.addressLine2 } : {}),
          ...(input.city ? { city: input.city } : {}),
          ...(input.state ? { state: input.state } : {}),
          ...(input.postalCode ? { postalCode: input.postalCode } : {}),
          ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
          ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
          ...(input.phone ? { phone: input.phone } : {}),
          ...(input.email ? { email: input.email } : {}),
        },
      })
      await this.audit('business_location.created', userId, businessId, location.id, request)
      return location
    } catch (cause) {
      if (this.isUniqueViolation(cause))
        throw new DomainError(
          'PRIMARY_LOCATION_ALREADY_EXISTS',
          'A primary active location already exists',
          HttpStatus.CONFLICT,
        )
      throw cause
    }
  }

  async updateLocation(
    userId: string,
    headers: BusinessContextHeaders,
    locationId: string,
    input: UpdateLocationDto,
    request: RequestMetadata,
  ) {
    const businessId = await this.resolve(userId, headers, businessPermissions.locationManage, true)
    const { version, ...fields } = input
    try {
      const updated = await this.database.businessLocation.updateMany({
        where: { id: locationId, businessOrganizationId: businessId, version },
        data: { ...fields, version: { increment: 1 } },
      })
      if (!updated.count) await this.notFoundOrConflict('location', locationId, businessId)
    } catch (cause) {
      if (this.isUniqueViolation(cause))
        throw new DomainError(
          'PRIMARY_LOCATION_ALREADY_EXISTS',
          'A primary active location already exists',
          HttpStatus.CONFLICT,
        )
      throw cause
    }
    await this.audit(
      fields.isActive === false ? 'business_location.deactivated' : 'business_location.updated',
      userId,
      businessId,
      locationId,
      request,
      { fields: Object.keys(fields) },
    )
    return this.database.businessLocation.findUnique({ where: { id: locationId } })
  }

  async deactivateLocation(
    userId: string,
    headers: BusinessContextHeaders,
    locationId: string,
    request: RequestMetadata,
  ) {
    const businessId = await this.resolve(userId, headers, businessPermissions.locationManage, true)
    const updated = await this.database.businessLocation.updateMany({
      where: { id: locationId, businessOrganizationId: businessId },
      data: { isActive: false, isPrimary: false, version: { increment: 1 } },
    })
    if (!updated.count) throw new NotFoundException('Location not found')
    await this.audit('business_location.deactivated', userId, businessId, locationId, request)
    return { deactivated: true }
  }

  async listServices(userId: string, headers: BusinessContextHeaders) {
    const businessId = await this.resolve(userId, headers, businessPermissions.serviceRead, false)
    return this.database.businessService.findMany({
      where: { businessOrganizationId: businessId },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      take: 100,
    })
  }

  async createService(
    userId: string,
    headers: BusinessContextHeaders,
    input: CreateServiceDto,
    request: RequestMetadata,
  ) {
    const businessId = await this.resolve(userId, headers, businessPermissions.serviceManage, true)
    this.validateService(input)
    const base = slugifyOrganizationName(input.name)
    let service
    try {
      service = await this.database.businessService.create({
        data: this.serviceCreateData(businessId, base, input),
      })
    } catch (cause) {
      if (!this.isUniqueViolation(cause)) throw cause
      service = await this.database.businessService.create({
        data: this.serviceCreateData(businessId, `${base}-${Date.now().toString(36)}`, input),
      })
    }
    await this.audit('business_service.created', userId, businessId, service.id, request)
    return service
  }

  async updateService(
    userId: string,
    headers: BusinessContextHeaders,
    serviceId: string,
    input: UpdateServiceDto,
    request: RequestMetadata,
  ) {
    const businessId = await this.resolve(userId, headers, businessPermissions.serviceManage, true)
    this.validateService(input)
    const { version, ...fields } = input
    const updated = await this.database.businessService.updateMany({
      where: { id: serviceId, businessOrganizationId: businessId, version },
      data: { ...fields, slug: slugifyOrganizationName(input.name), version: { increment: 1 } },
    })
    if (!updated.count) await this.notFoundOrConflict('service', serviceId, businessId)
    await this.audit(
      fields.isActive === false ? 'business_service.deactivated' : 'business_service.updated',
      userId,
      businessId,
      serviceId,
      request,
      { fields: Object.keys(fields) },
    )
    return this.database.businessService.findUnique({ where: { id: serviceId } })
  }

  async deactivateService(
    userId: string,
    headers: BusinessContextHeaders,
    serviceId: string,
    request: RequestMetadata,
  ) {
    const businessId = await this.resolve(userId, headers, businessPermissions.serviceManage, true)
    const updated = await this.database.businessService.updateMany({
      where: { id: serviceId, businessOrganizationId: businessId },
      data: { isActive: false, version: { increment: 1 } },
    })
    if (!updated.count)
      throw new DomainError(
        'BUSINESS_SERVICE_NOT_FOUND',
        'Business service not found',
        HttpStatus.NOT_FOUND,
      )
    await this.audit('business_service.deactivated', userId, businessId, serviceId, request)
    return { deactivated: true }
  }

  async listHours(userId: string, headers: BusinessContextHeaders) {
    const businessId = await this.resolve(userId, headers, businessPermissions.hoursRead, false)
    return this.database.businessHour.findMany({
      where: { businessOrganizationId: businessId },
      orderBy: [{ dayOfWeek: 'asc' }, { displayOrder: 'asc' }],
    })
  }

  async replaceHours(
    userId: string,
    headers: BusinessContextHeaders,
    input: ReplaceBusinessHoursDto,
    request: RequestMetadata,
  ) {
    const businessId = await this.resolve(userId, headers, businessPermissions.hoursManage, true)
    if (hasHourOverlap(input.hours))
      throw new DomainError(
        'BUSINESS_HOURS_OVERLAP',
        'Business-hour intervals cannot overlap',
        HttpStatus.CONFLICT,
      )
    for (const hour of input.hours) {
      if (
        !hour.isClosed &&
        (hour.opensAtMinutes === undefined ||
          hour.closesAtMinutes === undefined ||
          hour.closesAtMinutes <= hour.opensAtMinutes)
      )
        throw new DomainError('INVALID_BUSINESS_HOURS', 'Opening interval is invalid', 400)
    }
    try {
      await this.database.$transaction(async (transaction) => {
        await transaction.businessHour.deleteMany({ where: { businessOrganizationId: businessId } })
        if (input.hours.length)
          await transaction.businessHour.createMany({
            data: input.hours.map((hour) => ({
              businessOrganizationId: businessId,
              dayOfWeek: hour.dayOfWeek,
              isClosed: hour.isClosed,
              displayOrder: hour.displayOrder,
              opensAtMinutes: hour.opensAtMinutes ?? null,
              closesAtMinutes: hour.closesAtMinutes ?? null,
            })),
          })
        await transaction.auditLog.create({
          data: this.auditData('business_hours.changed', userId, businessId, businessId, request, {
            intervals: input.hours.length,
          }),
        })
      })
    } catch (cause) {
      if (this.isExclusionViolation(cause))
        throw new DomainError(
          'BUSINESS_HOURS_OVERLAP',
          'Business-hour intervals cannot overlap',
          HttpStatus.CONFLICT,
        )
      throw cause
    }
    return this.listHours(userId, headers)
  }

  async listSocialLinks(userId: string, headers: BusinessContextHeaders) {
    const businessId = await this.resolve(userId, headers, businessPermissions.socialRead, false)
    return this.database.businessSocialLink.findMany({
      where: { businessOrganizationId: businessId },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      take: 100,
    })
  }

  async createSocialLink(
    userId: string,
    headers: BusinessContextHeaders,
    input: CreateSocialLinkDto,
    request: RequestMetadata,
  ) {
    const businessId = await this.resolve(userId, headers, businessPermissions.socialManage, true)
    let url: string
    try {
      url = normalizeSocialUrl(input.platform, input.url)
    } catch {
      throw new DomainError(
        'INVALID_SOCIAL_LINK',
        'Social link must be a valid HTTP or HTTPS URL',
        400,
      )
    }
    const link = await this.database.businessSocialLink.create({
      data: {
        businessOrganizationId: businessId,
        platform: input.platform,
        url,
        displayLabel: input.displayLabel ?? null,
        isPrimary: input.isPrimary ?? false,
        displayOrder: input.displayOrder ?? 0,
      },
    })
    await this.audit('business_social_link.created', userId, businessId, link.id, request)
    return link
  }

  async updateSocialLink(
    userId: string,
    headers: BusinessContextHeaders,
    socialLinkId: string,
    input: UpdateSocialLinkDto,
    request: RequestMetadata,
  ) {
    const businessId = await this.resolve(userId, headers, businessPermissions.socialManage, true)
    let url: string
    try {
      url = normalizeSocialUrl(input.platform, input.url)
    } catch {
      throw new DomainError(
        'INVALID_SOCIAL_LINK',
        'Social link must be a valid HTTP or HTTPS URL',
        400,
      )
    }
    const { version, ...fields } = input
    const updated = await this.database.businessSocialLink.updateMany({
      where: { id: socialLinkId, businessOrganizationId: businessId, version },
      data: { ...fields, url, version: { increment: 1 } },
    })
    if (!updated.count) await this.notFoundOrConflict('social', socialLinkId, businessId)
    await this.audit('business_social_link.updated', userId, businessId, socialLinkId, request, {
      fields: Object.keys(fields),
    })
    return this.database.businessSocialLink.findUnique({ where: { id: socialLinkId } })
  }

  async deleteSocialLink(
    userId: string,
    headers: BusinessContextHeaders,
    socialLinkId: string,
    request: RequestMetadata,
  ) {
    const businessId = await this.resolve(userId, headers, businessPermissions.socialManage, true)
    const deleted = await this.database.businessSocialLink.deleteMany({
      where: { id: socialLinkId, businessOrganizationId: businessId },
    })
    if (!deleted.count) throw new NotFoundException('Social link not found')
    await this.audit('business_social_link.deleted', userId, businessId, socialLinkId, request)
    return { deleted: true }
  }

  async relationship(userId: string, businessId: string) {
    await this.permissions.requireType(
      userId,
      businessId,
      OrganizationType.BUSINESS,
      phase3Permissions.clientNoteRead,
    )
    const relationship = await this.database.agencyClientRelationship.findFirst({
      where: {
        businessOrganizationId: businessId,
        status: {
          in: [
            AgencyClientRelationshipStatus.PENDING,
            AgencyClientRelationshipStatus.ACTIVE,
            AgencyClientRelationshipStatus.SUSPENDED,
          ],
        },
      },
      select: {
        id: true,
        status: true,
        servicePlan: true,
        startedAt: true,
        primaryAccountManager: { select: { displayName: true } },
        agencyOrganization: { select: { name: true } },
      },
    })
    if (!relationship)
      throw new DomainError(
        'AGENCY_CLIENT_RELATIONSHIP_NOT_FOUND',
        'Agency client relationship not found',
        404,
      )
    return relationship
  }

  async clientNotes(userId: string, businessId: string) {
    await this.permissions.requireType(
      userId,
      businessId,
      OrganizationType.BUSINESS,
      phase3Permissions.clientNoteRead,
    )
    const relationship = await this.relationshipRecord(businessId)
    return this.database.agencyClientNote.findMany({
      where: {
        relationshipId: relationship.id,
        visibility: AgencyClientNoteVisibility.CLIENT_VISIBLE,
      },
      select: {
        id: true,
        body: true,
        createdAt: true,
        editedAt: true,
        author: { select: { displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }

  async createClientNote(
    userId: string,
    businessId: string,
    body: string,
    request: RequestMetadata,
  ) {
    await this.permissions.requireType(
      userId,
      businessId,
      OrganizationType.BUSINESS,
      phase3Permissions.clientNoteWrite,
    )
    const relationship = await this.relationshipRecord(businessId, true)
    const note = await this.database.agencyClientNote.create({
      data: {
        relationshipId: relationship.id,
        authorUserId: userId,
        visibility: AgencyClientNoteVisibility.CLIENT_VISIBLE,
        body: body.trim(),
      },
    })
    await this.audit('agency_client.note_client_created', userId, businessId, note.id, request, {
      relationshipId: relationship.id,
    })
    return note
  }

  private async resolve(
    userId: string,
    headers: BusinessContextHeaders,
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

  private async relationshipRecord(businessId: string, writable = false) {
    const allowed = writable
      ? [AgencyClientRelationshipStatus.ACTIVE]
      : [
          AgencyClientRelationshipStatus.PENDING,
          AgencyClientRelationshipStatus.ACTIVE,
          AgencyClientRelationshipStatus.SUSPENDED,
        ]
    const relationship = await this.database.agencyClientRelationship.findFirst({
      where: { businessOrganizationId: businessId, status: { in: allowed } },
    })
    if (!relationship)
      throw new DomainError(
        'AGENCY_CLIENT_RELATIONSHIP_NOT_FOUND',
        'Agency client relationship not found',
        404,
      )
    return relationship
  }

  private validateService(input: CreateServiceDto): void {
    if (!validatePrice(input.priceType, input.startingPriceMinor, input.maximumPriceMinor))
      throw new DomainError(
        'INVALID_SERVICE_PRICE',
        'Price fields do not match the selected price type',
        400,
      )
    if (input.currency && !isValidCurrency(input.currency))
      throw new DomainError('INVALID_CURRENCY', 'Currency code is not supported', 400)
  }

  private serviceCreateData(
    businessOrganizationId: string,
    slug: string,
    input: CreateServiceDto,
  ): Prisma.BusinessServiceUncheckedCreateInput {
    return {
      businessOrganizationId,
      slug,
      name: input.name,
      priceType: input.priceType,
      shortDescription: input.shortDescription ?? null,
      description: input.description ?? null,
      startingPriceMinor: input.startingPriceMinor ?? null,
      maximumPriceMinor: input.maximumPriceMinor ?? null,
      currency: input.currency ?? null,
      durationMinutes: input.durationMinutes ?? null,
      isActive: input.isActive ?? true,
      isFeatured: input.isFeatured ?? false,
      displayOrder: input.displayOrder ?? 0,
    }
  }

  private async notFoundOrConflict(
    type: 'location' | 'service' | 'social',
    id: string,
    businessId: string,
  ): Promise<never> {
    const exists =
      type === 'location'
        ? await this.database.businessLocation.count({
            where: { id, businessOrganizationId: businessId },
          })
        : type === 'service'
          ? await this.database.businessService.count({
              where: { id, businessOrganizationId: businessId },
            })
          : await this.database.businessSocialLink.count({
              where: { id, businessOrganizationId: businessId },
            })
    if (!exists) throw new NotFoundException(`${type} not found`)
    this.concurrencyError()
  }

  private concurrencyError(): never {
    throw new DomainError(
      'OPTIMISTIC_CONCURRENCY_CONFLICT',
      'The record changed; reload and try again',
      HttpStatus.CONFLICT,
    )
  }
  private isUniqueViolation(cause: unknown): boolean {
    return typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 'P2002'
  }
  private isExclusionViolation(cause: unknown): boolean {
    return (
      typeof cause === 'object' &&
      cause !== null &&
      'message' in cause &&
      String(cause.message).includes('business_hours_no_overlap')
    )
  }

  private auditData(
    action: string,
    actorUserId: string,
    organizationId: string,
    targetId: string,
    request: RequestMetadata,
    metadata?: Prisma.InputJsonValue,
  ): Prisma.AuditLogCreateInput {
    return {
      action,
      actor: { connect: { id: actorUserId } },
      organization: { connect: { id: organizationId } },
      targetType: 'phase3_resource',
      targetId,
      requestId: request.requestId,
      ipAddress: request.ipAddress,
      ...(metadata ? { metadata } : {}),
    }
  }
  private async audit(
    action: string,
    actorUserId: string,
    organizationId: string,
    targetId: string,
    request: RequestMetadata,
    metadata?: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.database.auditLog.create({
      data: this.auditData(action, actorUserId, organizationId, targetId, request, metadata),
    })
  }
}
