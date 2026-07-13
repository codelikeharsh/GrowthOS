import { Module } from '@nestjs/common'
import { AuditService } from './audit.service.js'
import { AuthenticationGuard } from './authentication.guard.js'
import { AuthController } from './auth.controller.js'
import { AuthService } from './auth.service.js'
import { CsrfGuard } from './csrf.guard.js'
import { DependenciesService } from './dependencies.service.js'
import { HealthController } from './health.controller.js'
import { MailService } from './mail.service.js'
import { InvitationController, OrganizationController } from './organization.controller.js'
import { OrganizationService } from './organization.service.js'
import { RateLimitService } from './rate-limit.service.js'
import { SessionService } from './session.service.js'
import { UserController } from './user.controller.js'
import { AgencyClientController } from './agency-client.controller.js'
import { AgencyClientService } from './agency-client.service.js'
import { BusinessProfileController } from './business-profile.controller.js'
import { BusinessProfileService } from './business-profile.service.js'
import { PermissionService } from './permission.service.js'

@Module({
  controllers: [
    HealthController,
    AuthController,
    UserController,
    OrganizationController,
    InvitationController,
    AgencyClientController,
    BusinessProfileController,
  ],
  providers: [
    DependenciesService,
    SessionService,
    AuthService,
    AuditService,
    MailService,
    RateLimitService,
    AuthenticationGuard,
    CsrfGuard,
    OrganizationService,
    PermissionService,
    AgencyClientService,
    BusinessProfileService,
  ],
})
// NestJS modules are metadata-bearing classes by framework convention.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AppModule {}
