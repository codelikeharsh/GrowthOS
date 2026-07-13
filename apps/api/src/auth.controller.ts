import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { AuditService, auditActions } from './audit.service.js'
import { AuthenticationGuard } from './authentication.guard.js'
import { AuthService } from './auth.service.js'
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto, TokenDto } from './auth.dto.js'
import { CsrfGuard } from './csrf.guard.js'
import { getApiEnvironment } from './environment.js'
import { CurrentAuth, getRequestMetadata, type AuthContext } from './request-context.js'
import { SessionService, type CreatedSession } from './session.service.js'

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  private readonly environment = getApiEnvironment()

  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  @Post('register')
  async register(@Body() body: RegisterDto, @Req() request: FastifyRequest) {
    return this.auth.register(
      body.email,
      body.displayName,
      body.password,
      getRequestMetadata(request),
    )
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() body: TokenDto, @Req() request: FastifyRequest) {
    return this.auth.verifyEmail(body.token, getRequestMetadata(request))
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const session = await this.auth.login(
      body.email,
      body.password,
      getRequestMetadata(request),
      request.cookies[this.environment.SESSION_COOKIE_NAME],
    )
    this.setSessionCookies(reply, session)
    return { message: 'Signed in.' }
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() body: ForgotPasswordDto, @Req() request: FastifyRequest) {
    return this.auth.forgotPassword(body.email, getRequestMetadata(request))
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() body: ResetPasswordDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const session = await this.auth.resetPassword(
      body.token,
      body.password,
      getRequestMetadata(request),
    )
    this.setSessionCookies(reply, session)
    return { message: 'Password reset and signed in.' }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthenticationGuard, CsrfGuard)
  async logout(
    @CurrentAuth() auth: AuthContext,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.sessions.revoke(auth.userId, auth.sessionId)
    await this.audit.record({
      action: auditActions.logout,
      actorUserId: auth.userId,
      targetType: 'session',
      targetId: auth.sessionId,
      request: getRequestMetadata(request),
    })
    this.clearSessionCookies(reply)
    return { message: 'Signed out.' }
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthenticationGuard, CsrfGuard)
  async logoutAll(
    @CurrentAuth() auth: AuthContext,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.sessions.revokeAll(auth.userId)
    await this.audit.record({
      action: auditActions.logout,
      actorUserId: auth.userId,
      metadata: { allSessions: true },
      request: getRequestMetadata(request),
    })
    this.clearSessionCookies(reply)
    return { message: 'Signed out everywhere.' }
  }

  @Get('sessions')
  @UseGuards(AuthenticationGuard)
  async listSessions(@CurrentAuth() auth: AuthContext) {
    const sessions = await this.sessions.list(auth.userId)
    return {
      sessions: sessions.map((session) => ({ ...session, current: session.id === auth.sessionId })),
    }
  }

  @Delete('sessions/:sessionId')
  @UseGuards(AuthenticationGuard, CsrfGuard)
  async revokeSession(
    @Param('sessionId') sessionId: string,
    @CurrentAuth() auth: AuthContext,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const revoked = await this.sessions.revoke(auth.userId, sessionId)
    if (revoked) {
      await this.audit.record({
        action: auditActions.sessionRevoked,
        actorUserId: auth.userId,
        targetType: 'session',
        targetId: sessionId,
        request: getRequestMetadata(request),
      })
    }
    if (sessionId === auth.sessionId) this.clearSessionCookies(reply)
    return { revoked }
  }

  setSessionCookies(reply: FastifyReply, session: CreatedSession): void {
    const secure = this.environment.NODE_ENV === 'production'
    const maxAge = Math.max(0, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000))
    reply.setCookie(this.environment.SESSION_COOKIE_NAME, session.rawSessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge,
    })
    reply.setCookie(this.environment.CSRF_COOKIE_NAME, session.rawCsrfToken, {
      httpOnly: false,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge,
    })
  }

  clearSessionCookies(reply: FastifyReply): void {
    reply.clearCookie(this.environment.SESSION_COOKIE_NAME, { path: '/' })
    reply.clearCookie(this.environment.CSRF_COOKIE_NAME, { path: '/' })
  }
}
