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
  Put,
  Req,
  UseGuards,
} from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { AuthenticationGuard } from './authentication.guard.js'
import { BusinessProfileService, type BusinessContextHeaders } from './business-profile.service.js'
import { CsrfGuard } from './csrf.guard.js'
import {
  CreateLocationDto,
  CreateNoteDto,
  CreateServiceDto,
  CreateSocialLinkDto,
  ReplaceBusinessHoursDto,
  UpdateBusinessProfileDto,
  UpdateLocationDto,
  UpdateServiceDto,
  UpdateSocialLinkDto,
} from './phase3.dto.js'
import { CurrentAuth, getRequestMetadata, type AuthContext } from './request-context.js'

@Controller({ path: 'business-profile', version: '1' })
@UseGuards(AuthenticationGuard)
export class BusinessProfileController {
  constructor(@Inject(BusinessProfileService) private readonly profiles: BusinessProfileService) {}

  @Get()
  get(@CurrentAuth() auth: AuthContext, @Headers() headers: Record<string, string>) {
    return this.profiles.getProfile(auth.userId, this.context(headers))
  }

  @Patch()
  @UseGuards(CsrfGuard)
  update(
    @CurrentAuth() auth: AuthContext,
    @Headers() headers: Record<string, string>,
    @Body() body: UpdateBusinessProfileDto,
    @Req() request: FastifyRequest,
  ) {
    return this.profiles.updateProfile(
      auth.userId,
      this.context(headers),
      body,
      getRequestMetadata(request),
    )
  }

  @Get('locations')
  locations(@CurrentAuth() auth: AuthContext, @Headers() headers: Record<string, string>) {
    return this.profiles.listLocations(auth.userId, this.context(headers))
  }

  @Post('locations')
  @UseGuards(CsrfGuard)
  createLocation(
    @CurrentAuth() auth: AuthContext,
    @Headers() headers: Record<string, string>,
    @Body() body: CreateLocationDto,
    @Req() request: FastifyRequest,
  ) {
    return this.profiles.createLocation(
      auth.userId,
      this.context(headers),
      body,
      getRequestMetadata(request),
    )
  }

  @Patch('locations/:locationId')
  @UseGuards(CsrfGuard)
  updateLocation(
    @CurrentAuth() auth: AuthContext,
    @Headers() headers: Record<string, string>,
    @Param('locationId') id: string,
    @Body() body: UpdateLocationDto,
    @Req() request: FastifyRequest,
  ) {
    return this.profiles.updateLocation(
      auth.userId,
      this.context(headers),
      id,
      body,
      getRequestMetadata(request),
    )
  }

  @Delete('locations/:locationId')
  @UseGuards(CsrfGuard)
  deactivateLocation(
    @CurrentAuth() auth: AuthContext,
    @Headers() headers: Record<string, string>,
    @Param('locationId') id: string,
    @Req() request: FastifyRequest,
  ) {
    return this.profiles.deactivateLocation(
      auth.userId,
      this.context(headers),
      id,
      getRequestMetadata(request),
    )
  }

  @Get('services')
  services(@CurrentAuth() auth: AuthContext, @Headers() headers: Record<string, string>) {
    return this.profiles.listServices(auth.userId, this.context(headers))
  }

  @Post('services')
  @UseGuards(CsrfGuard)
  createService(
    @CurrentAuth() auth: AuthContext,
    @Headers() headers: Record<string, string>,
    @Body() body: CreateServiceDto,
    @Req() request: FastifyRequest,
  ) {
    return this.profiles.createService(
      auth.userId,
      this.context(headers),
      body,
      getRequestMetadata(request),
    )
  }

  @Patch('services/:serviceId')
  @UseGuards(CsrfGuard)
  updateService(
    @CurrentAuth() auth: AuthContext,
    @Headers() headers: Record<string, string>,
    @Param('serviceId') id: string,
    @Body() body: UpdateServiceDto,
    @Req() request: FastifyRequest,
  ) {
    return this.profiles.updateService(
      auth.userId,
      this.context(headers),
      id,
      body,
      getRequestMetadata(request),
    )
  }

  @Delete('services/:serviceId')
  @UseGuards(CsrfGuard)
  deactivateService(
    @CurrentAuth() auth: AuthContext,
    @Headers() headers: Record<string, string>,
    @Param('serviceId') id: string,
    @Req() request: FastifyRequest,
  ) {
    return this.profiles.deactivateService(
      auth.userId,
      this.context(headers),
      id,
      getRequestMetadata(request),
    )
  }

  @Get('hours')
  hours(@CurrentAuth() auth: AuthContext, @Headers() headers: Record<string, string>) {
    return this.profiles.listHours(auth.userId, this.context(headers))
  }

  @Put('hours')
  @UseGuards(CsrfGuard)
  replaceHours(
    @CurrentAuth() auth: AuthContext,
    @Headers() headers: Record<string, string>,
    @Body() body: ReplaceBusinessHoursDto,
    @Req() request: FastifyRequest,
  ) {
    return this.profiles.replaceHours(
      auth.userId,
      this.context(headers),
      body,
      getRequestMetadata(request),
    )
  }

  @Get('social-links')
  socialLinks(@CurrentAuth() auth: AuthContext, @Headers() headers: Record<string, string>) {
    return this.profiles.listSocialLinks(auth.userId, this.context(headers))
  }

  @Post('social-links')
  @UseGuards(CsrfGuard)
  createSocialLink(
    @CurrentAuth() auth: AuthContext,
    @Headers() headers: Record<string, string>,
    @Body() body: CreateSocialLinkDto,
    @Req() request: FastifyRequest,
  ) {
    return this.profiles.createSocialLink(
      auth.userId,
      this.context(headers),
      body,
      getRequestMetadata(request),
    )
  }

  @Patch('social-links/:socialLinkId')
  @UseGuards(CsrfGuard)
  updateSocialLink(
    @CurrentAuth() auth: AuthContext,
    @Headers() headers: Record<string, string>,
    @Param('socialLinkId') id: string,
    @Body() body: UpdateSocialLinkDto,
    @Req() request: FastifyRequest,
  ) {
    return this.profiles.updateSocialLink(
      auth.userId,
      this.context(headers),
      id,
      body,
      getRequestMetadata(request),
    )
  }

  @Delete('social-links/:socialLinkId')
  @UseGuards(CsrfGuard)
  deleteSocialLink(
    @CurrentAuth() auth: AuthContext,
    @Headers() headers: Record<string, string>,
    @Param('socialLinkId') id: string,
    @Req() request: FastifyRequest,
  ) {
    return this.profiles.deleteSocialLink(
      auth.userId,
      this.context(headers),
      id,
      getRequestMetadata(request),
    )
  }

  @Get('relationship')
  relationship(@CurrentAuth() auth: AuthContext, @Headers('x-organization-id') businessId: string) {
    return this.profiles.relationship(auth.userId, businessId)
  }

  @Get('relationship/notes')
  notes(@CurrentAuth() auth: AuthContext, @Headers('x-organization-id') businessId: string) {
    return this.profiles.clientNotes(auth.userId, businessId)
  }

  @Post('relationship/notes')
  @UseGuards(CsrfGuard)
  createNote(
    @CurrentAuth() auth: AuthContext,
    @Headers('x-organization-id') businessId: string,
    @Body() body: CreateNoteDto,
    @Req() request: FastifyRequest,
  ) {
    return this.profiles.createClientNote(
      auth.userId,
      businessId,
      body.body,
      getRequestMetadata(request),
    )
  }

  private context(headers: Record<string, string>): BusinessContextHeaders {
    return {
      ...(headers['x-organization-id'] ? { businessId: headers['x-organization-id'] } : {}),
      ...(headers['x-agency-organization-id']
        ? { agencyId: headers['x-agency-organization-id'] }
        : {}),
      ...(headers['x-relationship-id'] ? { relationshipId: headers['x-relationship-id'] } : {}),
    }
  }
}
