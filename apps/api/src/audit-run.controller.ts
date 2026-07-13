import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { AuthenticationGuard } from './authentication.guard.js'
import { AuditRunService } from './audit-run.service.js'
import { CsrfGuard } from './csrf.guard.js'
import { CreateAuditDto, ListAuditsDto } from './phase3.dto.js'
import { CurrentAuth, getRequestMetadata, type AuthContext } from './request-context.js'
import type { WebsiteContextHeaders } from './website.service.js'

@Controller({ path: 'websites/:websiteId/audits', version: '1' })
@UseGuards(AuthenticationGuard)
export class AuditRunController {
  constructor(@Inject(AuditRunService) private readonly audits: AuditRunService) {}
  @Post()
  @UseGuards(CsrfGuard)
  create(
    @CurrentAuth() auth: AuthContext,
    @Param('websiteId') websiteId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Headers() headers: Record<string, string>,
    @Body() body: CreateAuditDto,
    @Req() request: FastifyRequest,
  ) {
    return this.audits.create(
      auth.userId,
      this.context(headers),
      websiteId,
      body,
      key,
      getRequestMetadata(request),
    )
  }
  @Get()
  list(
    @CurrentAuth() auth: AuthContext,
    @Param('websiteId') websiteId: string,
    @Headers() headers: Record<string, string>,
    @Query() query: ListAuditsDto,
  ) {
    return this.audits.list(auth.userId, this.context(headers), websiteId, query)
  }
  @Get(':auditId')
  get(
    @CurrentAuth() auth: AuthContext,
    @Param('websiteId') websiteId: string,
    @Param('auditId') auditId: string,
    @Headers() headers: Record<string, string>,
  ) {
    return this.audits.get(auth.userId, this.context(headers), websiteId, auditId)
  }
  @Delete(':auditId')
  @UseGuards(CsrfGuard)
  cancel(
    @CurrentAuth() auth: AuthContext,
    @Param('websiteId') websiteId: string,
    @Param('auditId') auditId: string,
    @Headers() headers: Record<string, string>,
    @Req() request: FastifyRequest,
  ) {
    return this.audits.cancel(
      auth.userId,
      this.context(headers),
      websiteId,
      auditId,
      getRequestMetadata(request),
    )
  }
  private context(headers: Record<string, string>): WebsiteContextHeaders {
    return {
      ...(headers['x-organization-id'] ? { businessId: headers['x-organization-id'] } : {}),
      ...(headers['x-agency-organization-id']
        ? { agencyId: headers['x-agency-organization-id'] }
        : {}),
      ...(headers['x-relationship-id'] ? { relationshipId: headers['x-relationship-id'] } : {}),
    }
  }
}
