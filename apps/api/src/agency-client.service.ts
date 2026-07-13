import {
  ConflictException,
  ForbiddenException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  AgencyClientNoteVisibility,
  AgencyClientRelationshipStatus,
  getDatabaseClient,
  InvitationStatus,
  MembershipStatus,
  OrganizationType,
  RoleName,
  type Prisma,
} from '@growthos/db'
import { DomainError } from './domain-error.js'
import { getApiEnvironment } from './environment.js'
import { MailService } from './mail.service.js'
import { PermissionService } from './permission.service.js'
import {
  type AssignAccountManagerDto,
  type CreateAgencyClientDto,
  type CreateNoteDto,
  type ListAgencyClientsDto,
  type ListNotesDto,
  type TransitionRelationshipDto,
  type UpdateNoteDto,
  type UpdateRelationshipDto,
} from './phase3.dto.js'
import { canTransitionRelationship, isValidCurrency, isValidTimezone } from './phase3-domain.js'
import type { RequestMetadata } from './request-context.js'
import {
  createOpaqueToken,
  hashToken,
  normalizeEmail,
  slugifyOrganizationName,
} from './security.js'

export const phase3Permissions = {
  clientRead: 'agency_client.read',
  clientCreate: 'agency_client.create',
  clientUpdate: 'agency_client.update',
  clientSuspend: 'agency_client.suspend',
  clientTerminate: 'agency_client.terminate',
  assignManager: 'agency_client.assign_manager',
  internalNoteRead: 'agency_client.notes.internal.read',
  internalNoteWrite: 'agency_client.notes.internal.write',
  clientNoteRead: 'agency_client.notes.client.read',
  clientNoteWrite: 'agency_client.notes.client.write',
} as const

@Injectable()
export class AgencyClientService {
  private readonly database = getDatabaseClient()
  private readonly environment = getApiEnvironment()

  constructor(
    @Inject(PermissionService) private readonly permissions: PermissionService,
    @Inject(MailService) private readonly mail: MailService,
  ) {}

  async create(
    userId: string,
    agencyId: string,
    input: CreateAgencyClientDto,
    idempotencyKey: string,
    request: RequestMetadata,
  ) {
    await this.permissions.requireType(
      userId,
      agencyId,
      OrganizationType.AGENCY,
      phase3Permissions.clientCreate,
    )
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
      throw new DomainError(
        'IDEMPOTENCY_KEY_REQUIRED',
        'A valid Idempotency-Key header is required',
        HttpStatus.BAD_REQUEST,
      )
    }
    if (input.timezone && !isValidTimezone(input.timezone))
      throw new DomainError('INVALID_TIMEZONE', 'Timezone must be a valid IANA identifier', 400)
    if (input.currency && !isValidCurrency(input.currency))
      throw new DomainError('INVALID_CURRENCY', 'Currency code is not supported', 400)
    const existing = await this.database.agencyClientRelationship.findUnique({
      where: {
        agencyOrganizationId_idempotencyKey: { agencyOrganizationId: agencyId, idempotencyKey },
      },
      include: this.relationshipInclude(),
    })
    if (existing) return this.serialize(existing)
    if (input.accountManagerUserId)
      await this.requireEligibleManager(agencyId, input.accountManagerUserId)
    const status = input.status ?? AgencyClientRelationshipStatus.PENDING
    if (
      status !== AgencyClientRelationshipStatus.PENDING &&
      status !== AgencyClientRelationshipStatus.ACTIVE
    )
      throw new DomainError(
        'INVALID_RELATIONSHIP_STATUS',
        'New relationships must be pending or active',
        400,
      )
    const ownerRole = await this.database.role.findUnique({ where: { name: RoleName.OWNER } })
    if (!ownerRole) throw new Error('Seeded owner role is missing')
    const token = input.clientOwnerEmail ? createOpaqueToken() : undefined
    const normalizedEmail = input.clientOwnerEmail
      ? normalizeEmail(input.clientOwnerEmail)
      : undefined
    const now = new Date()
    let created
    try {
      created = await this.database.$transaction(async (transaction) => {
        const slug = `${slugifyOrganizationName(input.tradeName ?? input.legalName)}-${createOpaqueToken().slice(0, 6).toLowerCase()}`
        const business = await transaction.organization.create({
          data: {
            name: input.tradeName?.trim() ?? input.legalName.trim(),
            slug,
            type: OrganizationType.BUSINESS,
          },
        })
        await transaction.businessProfile.create({
          data: {
            organizationId: business.id,
            legalName: input.legalName.trim(),
            ...(input.tradeName ? { tradeName: input.tradeName.trim() } : {}),
            timezone: input.timezone ?? 'UTC',
            currency: input.currency ?? 'USD',
            countryCode: input.countryCode ?? 'US',
          },
        })
        const relationship = await transaction.agencyClientRelationship.create({
          data: {
            agencyOrganizationId: agencyId,
            businessOrganizationId: business.id,
            status,
            startedAt: status === AgencyClientRelationshipStatus.ACTIVE ? now : null,
            primaryAccountManagerUserId: input.accountManagerUserId ?? userId,
            servicePlan: input.servicePlan?.trim() ?? null,
            createdByUserId: userId,
            idempotencyKey,
          },
        })
        await transaction.auditLog.createMany({
          data: [
            this.audit(
              'business.client_created',
              userId,
              agencyId,
              'organization',
              business.id,
              request,
            ),
            this.audit(
              'agency_client.relationship_created',
              userId,
              agencyId,
              'agency_client_relationship',
              relationship.id,
              request,
              { status },
            ),
            this.audit(
              'business_profile.created',
              userId,
              business.id,
              'business_profile',
              business.id,
              request,
            ),
          ],
        })
        if (normalizedEmail && token) {
          const invitation = await transaction.organizationInvitation.create({
            data: {
              organizationId: business.id,
              email: normalizedEmail,
              roleId: ownerRole.id,
              tokenHash: hashToken(token),
              invitedById: userId,
              expiresAt: new Date(Date.now() + this.environment.INVITATION_TTL_HOURS * 3_600_000),
            },
          })
          await transaction.auditLog.create({
            data: this.audit(
              'agency_client.owner_invited',
              userId,
              agencyId,
              'invitation',
              invitation.id,
              request,
              { relationshipId: relationship.id },
            ),
          })
        }
        return transaction.agencyClientRelationship.findUniqueOrThrow({
          where: { id: relationship.id },
          include: this.relationshipInclude(),
        })
      })
    } catch (cause) {
      if (this.isUniqueViolation(cause))
        throw new DomainError(
          'AGENCY_CLIENT_RELATIONSHIP_ALREADY_ACTIVE',
          'This business already has an active agency relationship',
          HttpStatus.CONFLICT,
        )
      throw cause
    }
    if (normalizedEmail && token) {
      await this.mail.sendInvitation(normalizedEmail, token, created.businessOrganization.name)
    }
    return this.serialize(created)
  }

  async list(userId: string, agencyId: string, query: ListAgencyClientsDto) {
    const actor = await this.permissions.requireType(
      userId,
      agencyId,
      OrganizationType.AGENCY,
      phase3Permissions.clientRead,
    )
    const assignedOnly = !this.permissions.has(actor, phase3Permissions.assignManager)
    const limit = numericQueryLimit(query.limit)
    const records = await this.database.agencyClientRelationship.findMany({
      where: {
        agencyOrganizationId: agencyId,
        ...(assignedOnly ? { primaryAccountManagerUserId: userId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.accountManagerUserId
          ? { primaryAccountManagerUserId: query.accountManagerUserId }
          : {}),
        ...(query.search
          ? {
              businessOrganization: {
                OR: [
                  { name: { contains: query.search, mode: 'insensitive' } },
                  {
                    businessProfile: { tradeName: { contains: query.search, mode: 'insensitive' } },
                  },
                ],
              },
            }
          : {}),
      },
      include: this.relationshipInclude(),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    })
    const hasMore = records.length > limit
    const page = records.slice(0, limit)
    return {
      clients: page.map((item) => this.serialize(item)),
      nextCursor: hasMore ? page.at(-1)?.id : null,
    }
  }

  async get(userId: string, agencyId: string, relationshipId: string) {
    const { relationship } = await this.requireAgencyRelationship(
      userId,
      agencyId,
      relationshipId,
      phase3Permissions.clientRead,
      false,
    )
    return this.serialize(relationship)
  }

  async update(
    userId: string,
    agencyId: string,
    relationshipId: string,
    input: UpdateRelationshipDto,
    request: RequestMetadata,
  ) {
    await this.requireAgencyRelationship(
      userId,
      agencyId,
      relationshipId,
      phase3Permissions.clientUpdate,
      true,
    )
    const result = await this.database.agencyClientRelationship.updateMany({
      where: { id: relationshipId, agencyOrganizationId: agencyId, version: input.version },
      data: { servicePlan: input.servicePlan?.trim() ?? null, version: { increment: 1 } },
    })
    if (!result.count) this.concurrencyError()
    await this.record(
      'agency_client.relationship_updated',
      userId,
      agencyId,
      relationshipId,
      request,
      { fields: ['servicePlan'] },
    )
    return this.get(userId, agencyId, relationshipId)
  }

  async transition(
    userId: string,
    agencyId: string,
    relationshipId: string,
    input: TransitionRelationshipDto,
    request: RequestMetadata,
  ) {
    const permission =
      input.status === AgencyClientRelationshipStatus.TERMINATED
        ? phase3Permissions.clientTerminate
        : phase3Permissions.clientSuspend
    const { relationship } = await this.requireAgencyRelationship(
      userId,
      agencyId,
      relationshipId,
      permission,
      false,
    )
    if (!canTransitionRelationship(relationship.status, input.status))
      throw new DomainError(
        'INVALID_RELATIONSHIP_TRANSITION',
        `Cannot transition ${relationship.status} to ${input.status}`,
        HttpStatus.CONFLICT,
      )
    const now = new Date()
    try {
      await this.database.$transaction(async (transaction) => {
        const updated = await transaction.agencyClientRelationship.updateMany({
          where: { id: relationshipId, agencyOrganizationId: agencyId, version: input.version },
          data: {
            status: input.status,
            version: { increment: 1 },
            ...(input.status === AgencyClientRelationshipStatus.ACTIVE
              ? { startedAt: relationship.startedAt ?? now, endedAt: null }
              : {}),
            ...(input.status === AgencyClientRelationshipStatus.TERMINATED ? { endedAt: now } : {}),
          },
        })
        if (!updated.count) this.concurrencyError()
        await transaction.auditLog.create({
          data: this.audit(
            `agency_client.relationship_${input.status.toLowerCase()}`,
            userId,
            agencyId,
            'agency_client_relationship',
            relationshipId,
            request,
            { from: relationship.status, to: input.status },
          ),
        })
      })
    } catch (cause) {
      if (this.isUniqueViolation(cause))
        throw new DomainError(
          'AGENCY_CLIENT_RELATIONSHIP_ALREADY_ACTIVE',
          'This business already has an active agency relationship',
          HttpStatus.CONFLICT,
        )
      throw cause
    }
    return this.get(userId, agencyId, relationshipId)
  }

  async assignManager(
    userId: string,
    agencyId: string,
    relationshipId: string,
    input: AssignAccountManagerDto,
    request: RequestMetadata,
  ) {
    await this.requireAgencyRelationship(
      userId,
      agencyId,
      relationshipId,
      phase3Permissions.assignManager,
      true,
    )
    if (input.userId) await this.requireEligibleManager(agencyId, input.userId)
    await this.database.$transaction(async (transaction) => {
      const updated = await transaction.agencyClientRelationship.updateMany({
        where: { id: relationshipId, agencyOrganizationId: agencyId, version: input.version },
        data: { primaryAccountManagerUserId: input.userId ?? null, version: { increment: 1 } },
      })
      if (!updated.count) this.concurrencyError()
      await transaction.auditLog.create({
        data: this.audit(
          input.userId
            ? 'agency_client.account_manager_assigned'
            : 'agency_client.account_manager_removed',
          userId,
          agencyId,
          'agency_client_relationship',
          relationshipId,
          request,
          input.userId ? { accountManagerUserId: input.userId } : undefined,
        ),
      })
    })
    return this.get(userId, agencyId, relationshipId)
  }

  async listNotes(userId: string, agencyId: string, relationshipId: string, query: ListNotesDto) {
    const { actor } = await this.requireAgencyRelationship(
      userId,
      agencyId,
      relationshipId,
      phase3Permissions.clientNoteRead,
      false,
    )
    const canReadInternal = this.permissions.has(actor, phase3Permissions.internalNoteRead)
    const limit = numericQueryLimit(query.limit)
    const records = await this.database.agencyClientNote.findMany({
      where: {
        relationshipId,
        ...(!canReadInternal ? { visibility: AgencyClientNoteVisibility.CLIENT_VISIBLE } : {}),
      },
      select: {
        id: true,
        visibility: true,
        body: true,
        editedAt: true,
        createdAt: true,
        updatedAt: true,
        author: { select: { id: true, displayName: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    })
    const page = records.slice(0, limit)
    return { notes: page, nextCursor: records.length > limit ? page.at(-1)?.id : null }
  }

  async createNote(
    userId: string,
    agencyId: string,
    relationshipId: string,
    input: CreateNoteDto,
    request: RequestMetadata,
  ) {
    const permission =
      input.visibility === AgencyClientNoteVisibility.AGENCY_INTERNAL
        ? phase3Permissions.internalNoteWrite
        : phase3Permissions.clientNoteWrite
    await this.requireAgencyRelationship(userId, agencyId, relationshipId, permission, true)
    const note = await this.database.agencyClientNote.create({
      data: {
        relationshipId,
        authorUserId: userId,
        visibility: input.visibility,
        body: input.body.trim(),
      },
    })
    await this.record(
      input.visibility === AgencyClientNoteVisibility.AGENCY_INTERNAL
        ? 'agency_client.note_internal_created'
        : 'agency_client.note_client_created',
      userId,
      agencyId,
      note.id,
      request,
      { relationshipId },
    )
    return note
  }

  async updateNote(
    userId: string,
    agencyId: string,
    relationshipId: string,
    noteId: string,
    input: UpdateNoteDto,
    request: RequestMetadata,
  ) {
    const note = await this.database.agencyClientNote.findFirst({
      where: { id: noteId, relationshipId },
    })
    if (!note) throw new NotFoundException('Note not found')
    const permission =
      note.visibility === AgencyClientNoteVisibility.AGENCY_INTERNAL
        ? phase3Permissions.internalNoteWrite
        : phase3Permissions.clientNoteWrite
    await this.requireAgencyRelationship(userId, agencyId, relationshipId, permission, true)
    const updated = await this.database.agencyClientNote.update({
      where: { id: noteId },
      data: { body: input.body.trim(), editedAt: new Date() },
    })
    await this.record(
      note.visibility === AgencyClientNoteVisibility.AGENCY_INTERNAL
        ? 'agency_client.note_internal_edited'
        : 'agency_client.note_client_edited',
      userId,
      agencyId,
      note.id,
      request,
      { relationshipId },
    )
    return updated
  }

  async inviteOwner(
    userId: string,
    agencyId: string,
    relationshipId: string,
    emailInput: string,
    request: RequestMetadata,
  ) {
    const { relationship } = await this.requireAgencyRelationship(
      userId,
      agencyId,
      relationshipId,
      phase3Permissions.clientUpdate,
      true,
    )
    const email = normalizeEmail(emailInput)
    const pending = await this.database.organizationInvitation.findFirst({
      where: {
        organizationId: relationship.businessOrganizationId,
        email,
        status: InvitationStatus.PENDING,
      },
    })
    if (pending && pending.expiresAt > new Date())
      throw new ConflictException('A pending invitation already exists')
    if (pending)
      await this.database.organizationInvitation.update({
        where: { id: pending.id },
        data: { status: InvitationStatus.EXPIRED },
      })
    const role = await this.database.role.findUnique({ where: { name: RoleName.OWNER } })
    if (!role) throw new Error('Seeded owner role is missing')
    const token = createOpaqueToken()
    const invitation = await this.database.organizationInvitation.create({
      data: {
        organizationId: relationship.businessOrganizationId,
        email,
        roleId: role.id,
        tokenHash: hashToken(token),
        invitedById: userId,
        expiresAt: new Date(Date.now() + this.environment.INVITATION_TTL_HOURS * 3_600_000),
      },
    })
    await this.mail.sendInvitation(email, token, relationship.businessOrganization.name)
    await this.record('agency_client.owner_invited', userId, agencyId, invitation.id, request, {
      relationshipId,
    })
    return { id: invitation.id, email, status: invitation.status, expiresAt: invitation.expiresAt }
  }

  async listInvitations(userId: string, agencyId: string, relationshipId: string) {
    const { relationship } = await this.requireAgencyRelationship(
      userId,
      agencyId,
      relationshipId,
      phase3Permissions.clientRead,
      false,
    )
    return this.database.organizationInvitation.findMany({
      where: { organizationId: relationship.businessOrganizationId },
      select: { id: true, email: true, status: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
  }

  async revokeInvitation(
    userId: string,
    agencyId: string,
    relationshipId: string,
    invitationId: string,
    request: RequestMetadata,
  ) {
    const { relationship } = await this.requireAgencyRelationship(
      userId,
      agencyId,
      relationshipId,
      phase3Permissions.clientUpdate,
      true,
    )
    const updated = await this.database.organizationInvitation.updateMany({
      where: {
        id: invitationId,
        organizationId: relationship.businessOrganizationId,
        status: InvitationStatus.PENDING,
      },
      data: { status: InvitationStatus.REVOKED, revokedAt: new Date() },
    })
    if (!updated.count) throw new NotFoundException('Invitation not found')
    await this.record(
      'agency_client.owner_invitation_revoked',
      userId,
      agencyId,
      invitationId,
      request,
      { relationshipId },
    )
    return { revoked: true }
  }

  async resendInvitation(
    userId: string,
    agencyId: string,
    relationshipId: string,
    invitationId: string,
    request: RequestMetadata,
  ) {
    const { relationship } = await this.requireAgencyRelationship(
      userId,
      agencyId,
      relationshipId,
      phase3Permissions.clientUpdate,
      true,
    )
    const old = await this.database.organizationInvitation.findFirst({
      where: {
        id: invitationId,
        organizationId: relationship.businessOrganizationId,
        status: InvitationStatus.PENDING,
      },
    })
    if (!old) throw new NotFoundException('Invitation not found')
    await this.database.organizationInvitation.update({
      where: { id: old.id },
      data: { status: InvitationStatus.REVOKED, revokedAt: new Date() },
    })
    const invitation = await this.inviteOwner(userId, agencyId, relationshipId, old.email, request)
    await this.record(
      'agency_client.owner_invitation_resent',
      userId,
      agencyId,
      invitationId,
      request,
      { relationshipId },
    )
    return invitation
  }

  async requireAgencyRelationship(
    userId: string,
    agencyId: string,
    relationshipId: string,
    permission: string,
    requireWritable: boolean,
  ) {
    const actor = await this.permissions.requireType(
      userId,
      agencyId,
      OrganizationType.AGENCY,
      permission,
    )
    const relationship = await this.database.agencyClientRelationship.findFirst({
      where: { id: relationshipId, agencyOrganizationId: agencyId },
      include: this.relationshipInclude(),
    })
    if (!relationship)
      throw new DomainError(
        'AGENCY_CLIENT_RELATIONSHIP_NOT_FOUND',
        'Agency client relationship not found',
        HttpStatus.NOT_FOUND,
      )
    if (
      !this.permissions.has(actor, phase3Permissions.assignManager) &&
      relationship.primaryAccountManagerUserId !== userId
    )
      throw new NotFoundException('Agency client relationship not found')
    if (
      requireWritable &&
      relationship.status !== AgencyClientRelationshipStatus.ACTIVE &&
      relationship.status !== AgencyClientRelationshipStatus.PENDING
    )
      throw new ForbiddenException('Relationship is not writable')
    return { actor, relationship }
  }

  private async requireEligibleManager(agencyId: string, userId: string): Promise<void> {
    const member = await this.database.organizationMember.findFirst({
      where: { organizationId: agencyId, userId, status: MembershipStatus.ACTIVE },
    })
    if (!member)
      throw new DomainError(
        'ACCOUNT_MANAGER_NOT_AGENCY_MEMBER',
        'Account manager must be an active agency member',
        HttpStatus.UNPROCESSABLE_ENTITY,
      )
  }

  private relationshipInclude() {
    return {
      businessOrganization: {
        include: {
          businessProfile: true,
          invitations: {
            where: { status: InvitationStatus.PENDING },
            select: { id: true, email: true, status: true, expiresAt: true },
            take: 1,
          },
        },
      },
      primaryAccountManager: { select: { id: true, displayName: true, email: true } },
    } satisfies Prisma.AgencyClientRelationshipInclude
  }

  private serialize(
    relationship: Prisma.AgencyClientRelationshipGetPayload<{
      include: ReturnType<AgencyClientService['relationshipInclude']>
    }>,
  ) {
    const privateEligible = relationship.status !== AgencyClientRelationshipStatus.TERMINATED
    return {
      id: relationship.id,
      agencyOrganizationId: relationship.agencyOrganizationId,
      businessOrganizationId: relationship.businessOrganizationId,
      status: relationship.status,
      isPrimary: relationship.isPrimary,
      servicePlan: relationship.servicePlan,
      startedAt: relationship.startedAt,
      endedAt: relationship.endedAt,
      version: relationship.version,
      createdAt: relationship.createdAt,
      business: {
        id: relationship.businessOrganization.id,
        name: relationship.businessOrganization.name,
        ...(privateEligible ? { profile: relationship.businessOrganization.businessProfile } : {}),
      },
      accountManager: relationship.primaryAccountManager,
      invitation: relationship.businessOrganization.invitations[0] ?? null,
    }
  }

  private audit(
    action: string,
    actorUserId: string,
    organizationId: string,
    targetType: string,
    targetId: string,
    request: RequestMetadata,
    metadata?: Prisma.InputJsonValue,
  ): Prisma.AuditLogCreateManyInput {
    return {
      action,
      actorUserId,
      organizationId,
      targetType,
      targetId,
      requestId: request.requestId,
      ipAddress: request.ipAddress,
      ...(metadata ? { metadata } : {}),
    }
  }

  private async record(
    action: string,
    actorUserId: string,
    organizationId: string,
    targetId: string,
    request: RequestMetadata,
    metadata?: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.database.auditLog.create({
      data: this.audit(
        action,
        actorUserId,
        organizationId,
        'phase3_resource',
        targetId,
        request,
        metadata,
      ),
    })
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
}

function numericQueryLimit(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) ? Math.min(50, Math.max(1, parsed)) : 20
}
