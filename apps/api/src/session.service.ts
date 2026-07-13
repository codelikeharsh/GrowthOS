import { Injectable, UnauthorizedException } from '@nestjs/common'
import { getDatabaseClient, UserStatus } from '@growthos/db'
import { getApiEnvironment } from './environment.js'
import type { AuthContext, RequestMetadata } from './request-context.js'
import { createOpaqueToken, hashToken, tokensMatch } from './security.js'

export interface CreatedSession {
  id: string
  rawSessionToken: string
  rawCsrfToken: string
  expiresAt: Date
}

@Injectable()
export class SessionService {
  private readonly database = getDatabaseClient()
  private readonly environment = getApiEnvironment()

  async create(
    userId: string,
    request: RequestMetadata,
    previous?: { id: string; userId: string },
  ): Promise<CreatedSession> {
    const rawSessionToken = createOpaqueToken()
    const rawCsrfToken = createOpaqueToken()
    const expiresAt = new Date(Date.now() + this.environment.SESSION_TTL_HOURS * 60 * 60 * 1000)

    const session = await this.database.$transaction(async (transaction) => {
      const created = await transaction.session.create({
        data: {
          userId,
          tokenHash: hashToken(rawSessionToken),
          csrfHash: hashToken(rawCsrfToken),
          expiresAt,
          ipAddress: request.ipAddress,
          userAgent: request.userAgent ?? null,
        },
      })
      if (previous?.userId === userId) {
        await transaction.session.updateMany({
          where: { id: previous.id, userId, revokedAt: null },
          data: { revokedAt: new Date(), replacedBySessionId: created.id },
        })
      }
      return created
    })
    return { id: session.id, rawSessionToken, rawCsrfToken, expiresAt }
  }

  async authenticate(rawToken: string | undefined): Promise<AuthContext> {
    if (!rawToken) throw new UnauthorizedException('Authentication required')
    const session = await this.database.session.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: { user: true },
    })
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.status !== UserStatus.ACTIVE
    ) {
      throw new UnauthorizedException('Authentication required')
    }
    await this.database.session.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    })
    return {
      sessionId: session.id,
      userId: session.userId,
      email: session.user.email,
      displayName: session.user.displayName,
      csrfHash: session.csrfHash,
      rawSessionToken: rawToken,
    }
  }

  validateCsrf(
    auth: AuthContext,
    headerToken: string | undefined,
    cookieToken: string | undefined,
  ): void {
    if (
      !headerToken ||
      !cookieToken ||
      headerToken !== cookieToken ||
      !tokensMatch(headerToken, auth.csrfHash)
    ) {
      throw new UnauthorizedException('Invalid CSRF token')
    }
  }

  async list(userId: string) {
    return this.database.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
        ipAddress: true,
        userAgent: true,
      },
      orderBy: { lastUsedAt: 'desc' },
    })
  }

  async revoke(userId: string, sessionId: string): Promise<boolean> {
    const result = await this.database.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return result.count === 1
  }

  async revokeAll(userId: string, exceptSessionId?: string): Promise<number> {
    const result = await this.database.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date() },
    })
    return result.count
  }
}
