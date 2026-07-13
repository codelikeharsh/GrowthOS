import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { AcceptInvitationDto } from './auth.dto.js'
import { AuthenticationGuard } from './authentication.guard.js'
import { CsrfGuard } from './csrf.guard.js'
import { getApiEnvironment } from './environment.js'
import {
  ChangeMemberRoleDto,
  CreateOrganizationDto,
  InviteMemberDto,
  UpdateOrganizationDto,
} from './organization.dto.js'
import { OrganizationService } from './organization.service.js'
import { CurrentAuth, getRequestMetadata, type AuthContext } from './request-context.js'
import { SessionService, type CreatedSession } from './session.service.js'

@Controller({ path: 'organizations', version: '1' })
@UseGuards(AuthenticationGuard)
export class OrganizationController {
  constructor(@Inject(OrganizationService) private readonly organizations: OrganizationService) {}

  @Get()
  async list(@CurrentAuth() auth: AuthContext) {
    return { organizations: await this.organizations.list(auth.userId) }
  }

  @Post()
  @UseGuards(CsrfGuard)
  async create(
    @Body() body: CreateOrganizationDto,
    @CurrentAuth() auth: AuthContext,
    @Req() request: FastifyRequest,
  ) {
    return this.organizations.create(auth.userId, body.name, body.type, getRequestMetadata(request))
  }

  @Get(':organizationId')
  async get(@Param('organizationId') organizationId: string, @CurrentAuth() auth: AuthContext) {
    return this.organizations.get(auth.userId, organizationId)
  }

  @Patch(':organizationId')
  @UseGuards(CsrfGuard)
  async update(
    @Param('organizationId') organizationId: string,
    @Body() body: UpdateOrganizationDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.organizations.update(auth.userId, organizationId, body.name)
  }

  @Get(':organizationId/members')
  async members(@Param('organizationId') organizationId: string, @CurrentAuth() auth: AuthContext) {
    return { members: await this.organizations.listMembers(auth.userId, organizationId) }
  }

  @Post(':organizationId/invitations')
  @UseGuards(CsrfGuard)
  async invite(
    @Param('organizationId') organizationId: string,
    @Body() body: InviteMemberDto,
    @CurrentAuth() auth: AuthContext,
    @Req() request: FastifyRequest,
  ) {
    return this.organizations.invite(
      auth.userId,
      organizationId,
      body.email,
      body.role,
      getRequestMetadata(request),
    )
  }

  @Get(':organizationId/invitations')
  async invitations(
    @Param('organizationId') organizationId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return { invitations: await this.organizations.listInvitations(auth.userId, organizationId) }
  }

  @Post(':organizationId/invitations/:invitationId/resend')
  @UseGuards(CsrfGuard)
  async resend(
    @Param('organizationId') organizationId: string,
    @Param('invitationId') invitationId: string,
    @CurrentAuth() auth: AuthContext,
    @Req() request: FastifyRequest,
  ) {
    return this.organizations.resendInvitation(
      auth.userId,
      organizationId,
      invitationId,
      getRequestMetadata(request),
    )
  }

  @Delete(':organizationId/invitations/:invitationId')
  @UseGuards(CsrfGuard)
  async revokeInvitation(
    @Param('organizationId') organizationId: string,
    @Param('invitationId') invitationId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.organizations.revokeInvitation(auth.userId, organizationId, invitationId)
  }

  @Patch(':organizationId/members/:memberId/role')
  @UseGuards(CsrfGuard)
  async changeRole(
    @Param('organizationId') organizationId: string,
    @Param('memberId') memberId: string,
    @Body() body: ChangeMemberRoleDto,
    @CurrentAuth() auth: AuthContext,
    @Req() request: FastifyRequest,
  ) {
    return this.organizations.changeRole(
      auth.userId,
      organizationId,
      memberId,
      body.role,
      getRequestMetadata(request),
    )
  }

  @Delete(':organizationId/members/:memberId')
  @UseGuards(CsrfGuard)
  async removeMember(
    @Param('organizationId') organizationId: string,
    @Param('memberId') memberId: string,
    @CurrentAuth() auth: AuthContext,
    @Req() request: FastifyRequest,
  ) {
    return this.organizations.removeMember(
      auth.userId,
      organizationId,
      memberId,
      getRequestMetadata(request),
    )
  }
}

@Controller({ path: 'invitations', version: '1' })
export class InvitationController {
  private readonly environment = getApiEnvironment()

  constructor(
    @Inject(OrganizationService) private readonly organizations: OrganizationService,
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  @Post('accept')
  @HttpCode(HttpStatus.OK)
  async accept(
    @Body() body: AcceptInvitationDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    let auth: AuthContext | undefined
    const rawSession = request.cookies[this.environment.SESSION_COOKIE_NAME]
    if (rawSession) {
      try {
        auth = await this.sessions.authenticate(rawSession)
        const csrfHeader = request.headers['x-csrf-token']
        this.sessions.validateCsrf(
          auth,
          typeof csrfHeader === 'string' ? csrfHeader : undefined,
          request.cookies[this.environment.CSRF_COOKIE_NAME],
        )
      } catch {
        auth = undefined
      }
    }
    const result = await this.organizations.accept(
      body.token,
      auth,
      body.displayName,
      body.password,
      getRequestMetadata(request),
    )
    if (result.session) this.setSessionCookies(reply, result.session)
    return { organizationId: result.organizationId, message: 'Invitation accepted.' }
  }

  private setSessionCookies(reply: FastifyReply, session: CreatedSession): void {
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
}
