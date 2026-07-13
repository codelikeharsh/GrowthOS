import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { AuthenticationGuard } from './authentication.guard.js'
import { CsrfGuard } from './csrf.guard.js'
import { CreateWebsiteDto, UpdateWebsiteDto } from './phase3.dto.js'
import { CurrentAuth, getRequestMetadata, type AuthContext } from './request-context.js'
import { WebsiteService, type WebsiteContextHeaders } from './website.service.js'

@Controller({ path: 'websites', version: '1' })
@UseGuards(AuthenticationGuard)
export class WebsiteController {
  constructor(@Inject(WebsiteService) private readonly websites: WebsiteService) {}

  @Get()
  list(@CurrentAuth() auth: AuthContext, @Headers() headers: Record<string, string>) {
    return this.websites.list(auth.userId, this.context(headers))
  }

  @Post()
  @UseGuards(CsrfGuard)
  create(
    @CurrentAuth() auth: AuthContext,
    @Headers() headers: Record<string, string>,
    @Body() body: CreateWebsiteDto,
    @Req() request: FastifyRequest,
  ) {
    return this.websites.create(
      auth.userId,
      this.context(headers),
      body,
      getRequestMetadata(request),
    )
  }

  @Get(':websiteId')
  get(
    @CurrentAuth() auth: AuthContext,
    @Headers() headers: Record<string, string>,
    @Param('websiteId') websiteId: string,
  ) {
    return this.websites.get(auth.userId, this.context(headers), websiteId)
  }

  @Patch(':websiteId')
  @UseGuards(CsrfGuard)
  update(
    @CurrentAuth() auth: AuthContext,
    @Headers() headers: Record<string, string>,
    @Param('websiteId') websiteId: string,
    @Body() body: UpdateWebsiteDto,
    @Req() request: FastifyRequest,
  ) {
    return this.websites.update(
      auth.userId,
      this.context(headers),
      websiteId,
      body,
      getRequestMetadata(request),
    )
  }

  @Delete(':websiteId')
  @UseGuards(CsrfGuard)
  disable(
    @CurrentAuth() auth: AuthContext,
    @Headers() headers: Record<string, string>,
    @Param('websiteId') websiteId: string,
    @Req() request: FastifyRequest,
  ) {
    return this.websites.disable(
      auth.userId,
      this.context(headers),
      websiteId,
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
