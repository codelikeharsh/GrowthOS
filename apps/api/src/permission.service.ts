import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { getDatabaseClient, MembershipStatus, OrganizationType } from '@growthos/db'

@Injectable()
export class PermissionService {
  private readonly database = getDatabaseClient()

  async require(userId: string, organizationId: string, permission: string) {
    const membership = await this.database.organizationMember.findFirst({
      where: { organizationId, userId, status: MembershipStatus.ACTIVE },
      include: {
        organization: true,
        role: { include: { permissions: { include: { permission: true } } } },
      },
    })
    if (!membership) throw new NotFoundException('Organization not found')
    if (!membership.role.permissions.some((item) => item.permission.name === permission)) {
      throw new ForbiddenException('Insufficient organization permission')
    }
    return membership
  }

  async requireType(
    userId: string,
    organizationId: string,
    type: OrganizationType,
    permission: string,
  ) {
    const membership = await this.require(userId, organizationId, permission)
    if (membership.organization.type !== type) throw new NotFoundException('Organization not found')
    return membership
  }

  has(membership: Awaited<ReturnType<PermissionService['require']>>, permission: string): boolean {
    return membership.role.permissions.some((item) => item.permission.name === permission)
  }
}
