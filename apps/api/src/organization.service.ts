import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import {
  getDatabaseClient,
  InvitationStatus,
  MembershipStatus,
  type OrganizationType,
  RoleName,
  UserStatus,
} from '@growthos/db'
import { AuditService, auditActions } from './audit.service.js'
import { getApiEnvironment } from './environment.js'
import { MailService } from './mail.service.js'
import type { AuthContext, RequestMetadata } from './request-context.js'
import {
  createOpaqueToken,
  hashPassword,
  hashToken,
  normalizeEmail,
  slugifyOrganizationName,
} from './security.js'
import { type CreatedSession, SessionService } from './session.service.js'
import { PermissionService } from './permission.service.js'

const permissions = {
  read: 'organization.read',
  update: 'organization.update',
  membersRead: 'organization.members.read',
  invite: 'organization.members.invite',
  remove: 'organization.members.remove',
  roles: 'organization.members.roles.manage',
  invitations: 'organization.invitations.manage',
} as const

@Injectable()
export class OrganizationService {
  private readonly database = getDatabaseClient()
  private readonly environment = getApiEnvironment()

  constructor(
    @Inject(MailService) private readonly mail: MailService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(PermissionService) private readonly permissionService: PermissionService,
  ) {}

  async create(
    userId: string,
    nameInput: string,
    type: OrganizationType,
    request: RequestMetadata,
  ): Promise<unknown> {
    const name = nameInput.trim()
    const baseSlug = slugifyOrganizationName(name)
    const slug = `${baseSlug}-${createOpaqueToken().slice(0, 6).toLowerCase()}`
    const owner = await this.getRole(RoleName.OWNER)
    const organization = await this.database.organization.create({
      data: {
        name,
        slug,
        type,
        memberships: { create: { userId, roleId: owner.id } },
      },
    })
    await this.audit.record({
      action: auditActions.organizationCreated,
      actorUserId: userId,
      organizationId: organization.id,
      targetType: 'organization',
      targetId: organization.id,
      request,
    })
    return organization
  }

  async list(userId: string): Promise<unknown> {
    const memberships = await this.database.organizationMember.findMany({
      where: { userId, status: MembershipStatus.ACTIVE },
      include: { organization: true, role: true },
      orderBy: { joinedAt: 'asc' },
    })
    return memberships.map(({ organization, role }) => ({ ...organization, role: role.name }))
  }

  async get(userId: string, organizationId: string): Promise<unknown> {
    await this.requirePermission(userId, organizationId, permissions.read)
    const organization = await this.database.organization.findUnique({
      where: { id: organizationId },
    })
    if (!organization) throw new NotFoundException('Organization not found')
    return organization
  }

  async update(userId: string, organizationId: string, nameInput: string): Promise<unknown> {
    await this.requirePermission(userId, organizationId, permissions.update)
    return this.database.organization.update({
      where: { id: organizationId },
      data: { name: nameInput.trim() },
    })
  }

  async listMembers(userId: string, organizationId: string): Promise<unknown> {
    await this.requirePermission(userId, organizationId, permissions.membersRead)
    return this.database.organizationMember.findMany({
      where: { organizationId, status: MembershipStatus.ACTIVE },
      select: {
        id: true,
        joinedAt: true,
        user: { select: { id: true, email: true, displayName: true } },
        role: { select: { name: true } },
      },
      orderBy: { joinedAt: 'asc' },
    })
  }

  async listInvitations(userId: string, organizationId: string): Promise<unknown> {
    await this.requirePermission(userId, organizationId, permissions.invitations)
    return this.database.organizationInvitation.findMany({
      where: { organizationId, status: InvitationStatus.PENDING },
      select: {
        id: true,
        email: true,
        expiresAt: true,
        createdAt: true,
        role: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async invite(
    userId: string,
    organizationId: string,
    emailInput: string,
    roleName: RoleName,
    request: RequestMetadata,
  ): Promise<unknown> {
    const actor = await this.requirePermission(userId, organizationId, permissions.invite)
    this.assertRoleAssignable(actor.role.name, roleName)
    const email = normalizeEmail(emailInput)
    const existingUser = await this.database.user.findUnique({
      where: { email },
      select: { id: true },
    })
    if (existingUser) {
      const member = await this.database.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId: existingUser.id } },
      })
      if (member?.status === MembershipStatus.ACTIVE)
        throw new ConflictException('User is already a member')
    }
    const pending = await this.database.organizationInvitation.findFirst({
      where: { organizationId, email, status: InvitationStatus.PENDING },
    })
    if (pending && pending.expiresAt <= new Date()) {
      await this.database.organizationInvitation.update({
        where: { id: pending.id },
        data: { status: InvitationStatus.EXPIRED },
      })
    } else if (pending) {
      throw new ConflictException('A pending invitation already exists')
    }
    const role = await this.getRole(roleName)
    const token = createOpaqueToken()
    const invitation = await this.database.organizationInvitation.create({
      data: {
        organizationId,
        email,
        roleId: role.id,
        tokenHash: hashToken(token),
        invitedById: userId,
        expiresAt: new Date(Date.now() + this.environment.INVITATION_TTL_HOURS * 60 * 60 * 1000),
      },
      include: { organization: true },
    })
    await this.mail.sendInvitation(email, token, invitation.organization.name)
    await this.audit.record({
      action: auditActions.memberInvited,
      actorUserId: userId,
      organizationId,
      targetType: 'invitation',
      targetId: invitation.id,
      metadata: { role: roleName },
      request,
    })
    return { id: invitation.id, email, expiresAt: invitation.expiresAt, role: roleName }
  }

  async revokeInvitation(userId: string, organizationId: string, invitationId: string) {
    await this.requirePermission(userId, organizationId, permissions.invitations)
    const result = await this.database.organizationInvitation.updateMany({
      where: { id: invitationId, organizationId, status: InvitationStatus.PENDING },
      data: { status: InvitationStatus.REVOKED, revokedAt: new Date() },
    })
    if (!result.count) throw new NotFoundException('Invitation not found')
    return { revoked: true }
  }

  async resendInvitation(
    userId: string,
    organizationId: string,
    invitationId: string,
    request: RequestMetadata,
  ): Promise<unknown> {
    await this.requirePermission(userId, organizationId, permissions.invitations)
    const old = await this.database.organizationInvitation.findFirst({
      where: { id: invitationId, organizationId, status: InvitationStatus.PENDING },
      include: { role: true },
    })
    if (!old) throw new NotFoundException('Invitation not found')
    await this.revokeInvitation(userId, organizationId, invitationId)
    return this.invite(userId, organizationId, old.email, old.role.name, request)
  }

  async accept(
    rawToken: string,
    auth: AuthContext | undefined,
    displayName: string | undefined,
    password: string | undefined,
    request: RequestMetadata,
  ): Promise<{ organizationId: string; session?: CreatedSession }> {
    const now = new Date()
    const invitation = await this.database.organizationInvitation.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: { role: true },
    })
    if (
      !invitation ||
      invitation.status !== InvitationStatus.PENDING ||
      invitation.expiresAt <= now
    ) {
      throw new UnauthorizedException('Invitation is invalid or expired')
    }
    let user = await this.database.user.findUnique({ where: { email: invitation.email } })
    let session: CreatedSession | undefined
    if (user) {
      if (!auth || auth.userId !== user.id || auth.email !== invitation.email) {
        throw new UnauthorizedException('Sign in with the invited email address')
      }
    } else {
      if (!displayName || !password)
        throw new BadRequestException('Name and password are required for a new account')
      user = await this.database.user.create({
        data: {
          email: invitation.email,
          displayName: displayName.trim(),
          passwordHash: await hashPassword(password),
          status: UserStatus.ACTIVE,
          emailVerifiedAt: now,
        },
      })
      session = await this.sessions.create(user.id, request)
    }
    await this.database.$transaction(async (transaction) => {
      const current = await transaction.organizationMember.findUnique({
        where: {
          organizationId_userId: { organizationId: invitation.organizationId, userId: user.id },
        },
      })
      if (current?.status === MembershipStatus.ACTIVE)
        throw new ConflictException('User is already a member')
      if (current) {
        await transaction.organizationMember.update({
          where: { id: current.id },
          data: {
            status: MembershipStatus.ACTIVE,
            roleId: invitation.roleId,
            revokedAt: null,
            joinedAt: now,
          },
        })
      } else {
        await transaction.organizationMember.create({
          data: {
            organizationId: invitation.organizationId,
            userId: user.id,
            roleId: invitation.roleId,
            invitedById: invitation.invitedById,
          },
        })
      }
      await transaction.organizationInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED, acceptedById: user.id, acceptedAt: now },
      })
    })
    await this.audit.record({
      action: auditActions.invitationAccepted,
      actorUserId: user.id,
      organizationId: invitation.organizationId,
      targetType: 'invitation',
      targetId: invitation.id,
      request,
    })
    return { organizationId: invitation.organizationId, ...(session ? { session } : {}) }
  }

  async changeRole(
    userId: string,
    organizationId: string,
    memberId: string,
    roleName: RoleName,
    request: RequestMetadata,
  ) {
    const actor = await this.requirePermission(userId, organizationId, permissions.roles)
    this.assertRoleAssignable(actor.role.name, roleName)
    const member = await this.database.organizationMember.findFirst({
      where: { id: memberId, organizationId, status: MembershipStatus.ACTIVE },
      include: { role: true },
    })
    if (!member) throw new NotFoundException('Member not found')
    if (member.role.name === RoleName.OWNER && actor.role.name !== RoleName.OWNER)
      throw new ForbiddenException()
    if (member.role.name === RoleName.OWNER && roleName !== RoleName.OWNER)
      await this.assertNotLastOwner(organizationId)
    const role = await this.getRole(roleName)
    await this.database.organizationMember.update({
      where: { id: member.id },
      data: { roleId: role.id },
    })
    await this.sessions.revokeAll(member.userId)
    await this.audit.record({
      action: auditActions.memberRoleChanged,
      actorUserId: userId,
      organizationId,
      targetType: 'membership',
      targetId: member.id,
      metadata: { from: member.role.name, to: roleName },
      request,
    })
    return { changed: true }
  }

  async removeMember(
    userId: string,
    organizationId: string,
    memberId: string,
    request: RequestMetadata,
  ) {
    const actor = await this.requirePermission(userId, organizationId, permissions.remove)
    const member = await this.database.organizationMember.findFirst({
      where: { id: memberId, organizationId, status: MembershipStatus.ACTIVE },
      include: { role: true },
    })
    if (!member) throw new NotFoundException('Member not found')
    if (member.role.name === RoleName.OWNER) {
      if (actor.role.name !== RoleName.OWNER) throw new ForbiddenException()
      await this.assertNotLastOwner(organizationId)
    }
    const unassigned = await this.database.$transaction(async (transaction) => {
      await transaction.organizationMember.update({
        where: { id: member.id },
        data: { status: MembershipStatus.REVOKED, revokedAt: new Date() },
      })
      return transaction.agencyClientRelationship.updateMany({
        where: { agencyOrganizationId: organizationId, primaryAccountManagerUserId: member.userId },
        data: { primaryAccountManagerUserId: null, version: { increment: 1 } },
      })
    })
    await this.sessions.revokeAll(member.userId)
    await this.audit.record({
      action: auditActions.memberRemoved,
      actorUserId: userId,
      organizationId,
      targetType: 'membership',
      targetId: member.id,
      metadata: { accountManagerAssignmentsCleared: unassigned.count },
      request,
    })
    return { removed: true }
  }

  private async requirePermission(userId: string, organizationId: string, permission: string) {
    return this.permissionService.require(userId, organizationId, permission)
  }

  private async getRole(name: RoleName) {
    const role = await this.database.role.findUnique({ where: { name } })
    if (!role) throw new Error(`Seeded role ${name} is missing`)
    return role
  }

  private assertRoleAssignable(actorRole: RoleName, targetRole: RoleName): void {
    if (targetRole === RoleName.OWNER && actorRole !== RoleName.OWNER) {
      throw new ForbiddenException('Only an owner can assign the owner role')
    }
  }

  private async assertNotLastOwner(organizationId: string): Promise<void> {
    const count = await this.database.organizationMember.count({
      where: { organizationId, status: MembershipStatus.ACTIVE, role: { name: RoleName.OWNER } },
    })
    if (count <= 1) throw new ConflictException('The last owner cannot be removed or demoted')
  }
}
