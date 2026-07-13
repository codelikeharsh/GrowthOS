import { PrismaClient } from '../generated/client/index.js'

export {
  AgencyClientNoteVisibility,
  AgencyClientRelationshipStatus,
  AuditRunStatus,
  AuditPageStatus,
  AuditTriggerType,
  BusinessDayOfWeek,
  BusinessLocationType,
  BusinessPriceType,
  BusinessSocialPlatform,
  InvitationStatus,
  MembershipStatus,
  OrganizationType,
  Prisma,
  RoleName,
  UserStatus,
} from '../generated/client/index.js'
export type {
  AgencyClientNote,
  AgencyClientRelationship,
  AuditLog,
  Organization,
  OrganizationInvitation,
  OrganizationMember,
  Permission,
  Role,
  Session,
  User,
  BusinessProfile,
  BusinessLocation,
  BusinessService,
  BusinessHour,
  BusinessSocialLink,
  Website,
  AuditRun,
  AuditPage,
  OutboxEvent,
} from '../generated/client/index.js'

let client: PrismaClient | undefined

export function getDatabaseClient(): PrismaClient {
  client ??= new PrismaClient()
  return client
}

export async function checkDatabaseConnection(database = getDatabaseClient()): Promise<void> {
  await database.$queryRaw`SELECT 1`
}

export async function disconnectDatabase(): Promise<void> {
  if (client) {
    await client.$disconnect()
    client = undefined
  }
}

export type { PrismaClient }
