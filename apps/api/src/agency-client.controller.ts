import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Delete,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { AgencyClientService } from './agency-client.service.js'
import { AuthenticationGuard } from './authentication.guard.js'
import { CsrfGuard } from './csrf.guard.js'
import {
  AssignAccountManagerDto,
  CreateAgencyClientDto,
  CreateNoteDto,
  InviteClientOwnerDto,
  ListAgencyClientsDto,
  ListNotesDto,
  TransitionRelationshipDto,
  UpdateNoteDto,
  UpdateRelationshipDto,
} from './phase3.dto.js'
import { CurrentAuth, getRequestMetadata, type AuthContext } from './request-context.js'

@Controller({ path: 'agency-clients', version: '1' })
@UseGuards(AuthenticationGuard)
export class AgencyClientController {
  constructor(@Inject(AgencyClientService) private readonly clients: AgencyClientService) {}

  @Post()
  @UseGuards(CsrfGuard)
  create(
    @CurrentAuth() auth: AuthContext,
    @Headers('x-organization-id') agencyId: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() body: CreateAgencyClientDto,
    @Req() request: FastifyRequest,
  ) {
    return this.clients.create(
      auth.userId,
      agencyId,
      body,
      idempotencyKey,
      getRequestMetadata(request),
    )
  }

  @Get()
  list(
    @CurrentAuth() auth: AuthContext,
    @Headers('x-organization-id') agencyId: string,
    @Query() query: ListAgencyClientsDto,
  ) {
    return this.clients.list(auth.userId, agencyId, query)
  }

  @Get(':relationshipId')
  get(
    @CurrentAuth() auth: AuthContext,
    @Headers('x-organization-id') agencyId: string,
    @Param('relationshipId') relationshipId: string,
  ) {
    return this.clients.get(auth.userId, agencyId, relationshipId)
  }

  @Patch(':relationshipId')
  @UseGuards(CsrfGuard)
  update(
    @CurrentAuth() auth: AuthContext,
    @Headers('x-organization-id') agencyId: string,
    @Param('relationshipId') relationshipId: string,
    @Body() body: UpdateRelationshipDto,
    @Req() request: FastifyRequest,
  ) {
    return this.clients.update(
      auth.userId,
      agencyId,
      relationshipId,
      body,
      getRequestMetadata(request),
    )
  }

  @Patch(':relationshipId/status')
  @UseGuards(CsrfGuard)
  transition(
    @CurrentAuth() auth: AuthContext,
    @Headers('x-organization-id') agencyId: string,
    @Param('relationshipId') relationshipId: string,
    @Body() body: TransitionRelationshipDto,
    @Req() request: FastifyRequest,
  ) {
    return this.clients.transition(
      auth.userId,
      agencyId,
      relationshipId,
      body,
      getRequestMetadata(request),
    )
  }

  @Patch(':relationshipId/account-manager')
  @UseGuards(CsrfGuard)
  assignManager(
    @CurrentAuth() auth: AuthContext,
    @Headers('x-organization-id') agencyId: string,
    @Param('relationshipId') relationshipId: string,
    @Body() body: AssignAccountManagerDto,
    @Req() request: FastifyRequest,
  ) {
    return this.clients.assignManager(
      auth.userId,
      agencyId,
      relationshipId,
      body,
      getRequestMetadata(request),
    )
  }

  @Get(':relationshipId/notes')
  notes(
    @CurrentAuth() auth: AuthContext,
    @Headers('x-organization-id') agencyId: string,
    @Param('relationshipId') relationshipId: string,
    @Query() query: ListNotesDto,
  ) {
    return this.clients.listNotes(auth.userId, agencyId, relationshipId, query)
  }

  @Post(':relationshipId/notes')
  @UseGuards(CsrfGuard)
  createNote(
    @CurrentAuth() auth: AuthContext,
    @Headers('x-organization-id') agencyId: string,
    @Param('relationshipId') relationshipId: string,
    @Body() body: CreateNoteDto,
    @Req() request: FastifyRequest,
  ) {
    return this.clients.createNote(
      auth.userId,
      agencyId,
      relationshipId,
      body,
      getRequestMetadata(request),
    )
  }

  @Patch(':relationshipId/notes/:noteId')
  @UseGuards(CsrfGuard)
  updateNote(
    @CurrentAuth() auth: AuthContext,
    @Headers('x-organization-id') agencyId: string,
    @Param('relationshipId') relationshipId: string,
    @Param('noteId') noteId: string,
    @Body() body: UpdateNoteDto,
    @Req() request: FastifyRequest,
  ) {
    return this.clients.updateNote(
      auth.userId,
      agencyId,
      relationshipId,
      noteId,
      body,
      getRequestMetadata(request),
    )
  }

  @Get(':relationshipId/invitations')
  invitations(
    @CurrentAuth() auth: AuthContext,
    @Headers('x-organization-id') agencyId: string,
    @Param('relationshipId') relationshipId: string,
  ) {
    return this.clients.listInvitations(auth.userId, agencyId, relationshipId)
  }

  @Post(':relationshipId/invitations')
  @UseGuards(CsrfGuard)
  invite(
    @CurrentAuth() auth: AuthContext,
    @Headers('x-organization-id') agencyId: string,
    @Param('relationshipId') relationshipId: string,
    @Body() body: InviteClientOwnerDto,
    @Req() request: FastifyRequest,
  ) {
    return this.clients.inviteOwner(
      auth.userId,
      agencyId,
      relationshipId,
      body.email,
      getRequestMetadata(request),
    )
  }

  @Post(':relationshipId/invitations/:invitationId/resend')
  @UseGuards(CsrfGuard)
  resendInvitation(
    @CurrentAuth() auth: AuthContext,
    @Headers('x-organization-id') agencyId: string,
    @Param('relationshipId') relationshipId: string,
    @Param('invitationId') invitationId: string,
    @Req() request: FastifyRequest,
  ) {
    return this.clients.resendInvitation(
      auth.userId,
      agencyId,
      relationshipId,
      invitationId,
      getRequestMetadata(request),
    )
  }

  @Delete(':relationshipId/invitations/:invitationId')
  @UseGuards(CsrfGuard)
  revokeInvitation(
    @CurrentAuth() auth: AuthContext,
    @Headers('x-organization-id') agencyId: string,
    @Param('relationshipId') relationshipId: string,
    @Param('invitationId') invitationId: string,
    @Req() request: FastifyRequest,
  ) {
    return this.clients.revokeInvitation(
      auth.userId,
      agencyId,
      relationshipId,
      invitationId,
      getRequestMetadata(request),
    )
  }
}
