import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Res,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import type { FastifyReply } from 'fastify'
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
  @Get(':auditId/findings')
  findings(
    @CurrentAuth() auth: AuthContext,
    @Param('websiteId') websiteId: string,
    @Param('auditId') auditId: string,
    @Headers() headers: Record<string, string>,
    @Query()
    query: {
      severity?: string
      category?: string
      ruleId?: string
      pageId?: string
      search?: string
      limit?: number
    },
  ) {
    return this.audits.findings(auth.userId, this.context(headers), websiteId, auditId, query)
  }
  @Get(':auditId/links')
  links(
    @CurrentAuth() auth: AuthContext,
    @Param('websiteId') websiteId: string,
    @Param('auditId') auditId: string,
    @Headers() headers: Record<string, string>,
    @Query() query: { kind?: string; status?: string; limit?: number },
  ) {
    return this.audits.links(auth.userId, this.context(headers), websiteId, auditId, query)
  }
  @Get(':auditId/report')
  report(
    @CurrentAuth() auth: AuthContext,
    @Param('websiteId') websiteId: string,
    @Param('auditId') auditId: string,
    @Headers() headers: Record<string, string>,
  ) {
    return this.audits.report(auth.userId, this.context(headers), websiteId, auditId)
  }
  @Get(':auditId/events')
  async events(
    @CurrentAuth() auth: AuthContext,
    @Param('websiteId') websiteId: string,
    @Param('auditId') auditId: string,
    @Headers() headers: Record<string, string>,
    @Res() reply: FastifyReply,
  ) {
    await this.audits.get(auth.userId, this.context(headers), websiteId, auditId)
    // Keep Fastify's already-authorized CORS headers intact. Calling raw
    // writeHead here replaces them, which prevents the authenticated
    // cross-origin browser stream from connecting.
    reply.hijack()
    for (const [name, value] of Object.entries(reply.getHeaders())) {
      if (value !== undefined) reply.raw.setHeader(name, value)
    }
    reply.raw.statusCode = 200
    reply.raw.setHeader('content-type', 'text/event-stream')
    reply.raw.setHeader('cache-control', 'no-cache')
    reply.raw.setHeader('connection', 'keep-alive')
    // This is an authenticated CORS response, not an embeddable resource.
    // Helmet's default same-origin resource policy otherwise blocks a browser
    // fetch stream even when the approved CORS origin and credentials match.
    reply.raw.setHeader('cross-origin-resource-policy', 'cross-origin')
    reply.raw.flushHeaders()
    const send = async (): Promise<void> => {
      const audit = await this.audits.get(auth.userId, this.context(headers), websiteId, auditId)
      reply.raw.write(
        `event: progress\ndata: ${JSON.stringify({ status: audit.status, progressStage: audit.progressStage, pagesDiscovered: audit.pagesDiscovered, pagesProcessed: audit.pagesProcessed, linksChecked: audit.linksChecked })}\n\n`,
      )
    }
    await send()
    const timer = setInterval(() => {
      void send()
    }, 2_000)
    reply.raw.on('close', () => {
      clearInterval(timer)
    })
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
