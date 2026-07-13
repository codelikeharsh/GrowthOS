import { Injectable } from '@nestjs/common'
import { getDatabaseClient, type Prisma } from '@growthos/db'
import type { RequestMetadata } from './request-context.js'

export const auditActions = {
  registration: 'auth.registration',
  emailVerification: 'auth.email_verification',
  loginSuccess: 'auth.login_success',
  loginFailure: 'auth.login_failure',
  logout: 'auth.logout',
  passwordResetRequest: 'auth.password_reset_request',
  passwordResetComplete: 'auth.password_reset_complete',
  organizationCreated: 'organization.created',
  memberInvited: 'organization.member_invited',
  invitationAccepted: 'organization.invitation_accepted',
  memberRoleChanged: 'organization.member_role_changed',
  memberRemoved: 'organization.member_removed',
  sessionRevoked: 'auth.session_revoked',
} as const

interface AuditEvent {
  action: (typeof auditActions)[keyof typeof auditActions]
  actorUserId?: string
  organizationId?: string
  targetType?: string
  targetId?: string
  metadata?: Prisma.InputJsonValue
  request: RequestMetadata
}

@Injectable()
export class AuditService {
  private readonly database = getDatabaseClient()

  async record(event: AuditEvent): Promise<void> {
    await this.database.auditLog.create({
      data: {
        action: event.action,
        ...(event.actorUserId ? { actorUserId: event.actorUserId } : {}),
        ...(event.organizationId ? { organizationId: event.organizationId } : {}),
        ...(event.targetType ? { targetType: event.targetType } : {}),
        ...(event.targetId ? { targetId: event.targetId } : {}),
        ...(event.metadata ? { metadata: event.metadata } : {}),
        requestId: event.request.requestId,
        ipAddress: event.request.ipAddress,
      },
    })
  }
}
