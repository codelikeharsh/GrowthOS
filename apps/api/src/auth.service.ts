import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { getDatabaseClient, UserStatus } from '@growthos/db'
import { AuditService, auditActions } from './audit.service.js'
import { getApiEnvironment } from './environment.js'
import { EmailDeliveryError, MailService } from './mail.service.js'
import { RateLimitService } from './rate-limit.service.js'
import type { RequestMetadata } from './request-context.js'
import {
  createOpaqueToken,
  hashPassword,
  hashToken,
  normalizeEmail,
  verifyPassword,
} from './security.js'
import { type CreatedSession, SessionService } from './session.service.js'

@Injectable()
export class AuthService {
  private readonly database = getDatabaseClient()
  private readonly environment = getApiEnvironment()

  constructor(
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(MailService) private readonly mail: MailService,
    @Inject(RateLimitService) private readonly rateLimit: RateLimitService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async register(
    emailInput: string,
    displayNameInput: string,
    password: string,
    request: RequestMetadata,
  ) {
    const email = normalizeEmail(emailInput)
    const displayName = displayNameInput.trim()
    const passwordHash = await hashPassword(password)
    const token = createOpaqueToken()
    const existing = await this.database.user.findUnique({ where: { email }, select: { id: true } })
    if (existing)
      throw new ConflictException(
        'An account with this email already exists. Request another verification email if needed.',
      )
    const user = await this.database.user.create({
      data: {
        email,
        displayName,
        passwordHash,
        emailVerificationTokens: {
          create: {
            tokenHash: hashToken(token),
            expiresAt: new Date(
              Date.now() + this.environment.EMAIL_VERIFICATION_TTL_MINUTES * 60_000,
            ),
          },
        },
      },
    })
    await this.audit.record({
      action: auditActions.registration,
      actorUserId: user.id,
      targetType: 'user',
      targetId: user.id,
      request,
    })
    try {
      await this.mail.sendEmailVerification(email, token)
      return {
        message: 'Registration created. Check your email to verify the account.',
        verificationEmailSent: true,
      }
    } catch (error) {
      if (!(error instanceof EmailDeliveryError)) throw error
      return {
        message:
          'Registration created, but we could not send the verification email. Use resend verification to try again.',
        verificationEmailSent: false,
      }
    }
  }

  async resendVerification(emailInput: string, request: RequestMetadata) {
    const email = normalizeEmail(emailInput)
    await this.rateLimit.consume(
      'email-verification',
      `${email}:${request.ipAddress}`,
      this.environment.EMAIL_VERIFICATION_RESEND_RATE_LIMIT,
    )
    const user = await this.database.user.findUnique({
      where: { email },
      select: { id: true, email: true, status: true, emailVerifiedAt: true },
    })
    if (!user || user.status !== UserStatus.PENDING_VERIFICATION || user.emailVerifiedAt) {
      return {
        message: 'If that account requires verification, a verification email will be sent.',
      }
    }
    const token = createOpaqueToken()
    const verification = await this.database.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + this.environment.EMAIL_VERIFICATION_TTL_MINUTES * 60_000),
      },
    })
    try {
      await this.mail.sendEmailVerification(user.email, token)
    } catch (error) {
      await this.database.emailVerificationToken.delete({ where: { id: verification.id } })
      if (!(error instanceof EmailDeliveryError)) throw error
      return {
        message: 'If that account requires verification, a verification email will be sent.',
      }
    }
    await this.database.emailVerificationToken.updateMany({
      where: { userId: user.id, consumedAt: null, id: { not: verification.id } },
      data: { consumedAt: new Date() },
    })
    return { message: 'If that account requires verification, a verification email will be sent.' }
  }

  async verifyEmail(rawToken: string, request: RequestMetadata) {
    const now = new Date()
    const record = await this.database.emailVerificationToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    })
    if (!record || record.consumedAt || record.expiresAt <= now) {
      throw new UnauthorizedException('Verification token is invalid or expired')
    }
    await this.database.$transaction([
      this.database.emailVerificationToken.update({
        where: { id: record.id },
        data: { consumedAt: now },
      }),
      this.database.user.update({
        where: { id: record.userId },
        data: { status: UserStatus.ACTIVE, emailVerifiedAt: now },
      }),
    ])
    await this.audit.record({
      action: auditActions.emailVerification,
      actorUserId: record.userId,
      targetType: 'user',
      targetId: record.userId,
      request,
    })
    return { message: 'Email verified. You can now sign in.' }
  }

  async login(
    emailInput: string,
    password: string,
    request: RequestMetadata,
    previousRawToken?: string,
  ): Promise<CreatedSession> {
    const email = normalizeEmail(emailInput)
    await this.rateLimit.consume(
      'login',
      `${email}:${request.ipAddress}`,
      this.environment.LOGIN_RATE_LIMIT,
    )
    const user = await this.database.user.findUnique({ where: { email } })
    const valid = user ? await verifyPassword(user.passwordHash, password) : false
    if (!user || !valid || user.status !== UserStatus.ACTIVE || !user.emailVerifiedAt) {
      await this.audit.record({
        action: auditActions.loginFailure,
        metadata: { emailHash: hashToken(email) },
        request,
      })
      throw new UnauthorizedException('Invalid email or password')
    }
    const previous = await this.getPreviousSession(previousRawToken)
    const session = await this.sessions.create(user.id, request, previous)
    await this.audit.record({
      action: auditActions.loginSuccess,
      actorUserId: user.id,
      targetType: 'session',
      targetId: session.id,
      request,
    })
    return session
  }

  async forgotPassword(emailInput: string, request: RequestMetadata) {
    const email = normalizeEmail(emailInput)
    await this.rateLimit.consume(
      'password-reset',
      `${email}:${request.ipAddress}`,
      this.environment.PASSWORD_RESET_RATE_LIMIT,
    )
    const user = await this.database.user.findUnique({ where: { email } })
    if (user && user.status === UserStatus.ACTIVE) {
      const token = createOpaqueToken()
      await this.database.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + this.environment.PASSWORD_RESET_TTL_MINUTES * 60_000),
        },
      })
      await this.mail.sendPasswordReset(email, token)
      await this.audit.record({
        action: auditActions.passwordResetRequest,
        actorUserId: user.id,
        targetType: 'user',
        targetId: user.id,
        request,
      })
    }
    return { message: 'If an eligible account exists, a password reset email has been sent.' }
  }

  async resetPassword(
    rawToken: string,
    password: string,
    request: RequestMetadata,
  ): Promise<CreatedSession> {
    const now = new Date()
    const record = await this.database.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    })
    if (!record || record.consumedAt || record.expiresAt <= now) {
      throw new UnauthorizedException('Reset token is invalid or expired')
    }
    const passwordHash = await hashPassword(password)
    await this.database.$transaction([
      this.database.passwordResetToken.updateMany({
        where: { userId: record.userId, consumedAt: null },
        data: { consumedAt: now },
      }),
      this.database.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.database.session.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: now },
      }),
    ])
    const session = await this.sessions.create(record.userId, request)
    await this.audit.record({
      action: auditActions.passwordResetComplete,
      actorUserId: record.userId,
      targetType: 'user',
      targetId: record.userId,
      request,
    })
    return session
  }

  private async getPreviousSession(rawToken: string | undefined) {
    if (!rawToken) return undefined
    try {
      const auth = await this.sessions.authenticate(rawToken)
      return { id: auth.sessionId, userId: auth.userId }
    } catch {
      return undefined
    }
  }
}
