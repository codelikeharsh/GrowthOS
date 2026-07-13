import { PrismaClient } from '../generated/client/index.js'

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
