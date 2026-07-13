import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { getApiEnvironment } from './environment.js'
import { SessionService } from './session.service.js'

@Injectable()
export class AuthenticationGuard implements CanActivate {
  private readonly environment = getApiEnvironment()

  constructor(@Inject(SessionService) private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>()
    request.auth = await this.sessions.authenticate(
      request.cookies[this.environment.SESSION_COOKIE_NAME],
    )
    return true
  }
}
