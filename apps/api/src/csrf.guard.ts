import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { getApiEnvironment } from './environment.js'
import { SessionService } from './session.service.js'

@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly environment = getApiEnvironment()

  constructor(@Inject(SessionService) private readonly sessions: SessionService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>()
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true
    if (!request.auth) return false
    const header = request.headers['x-csrf-token']
    this.sessions.validateCsrf(
      request.auth,
      typeof header === 'string' ? header : undefined,
      request.cookies[this.environment.CSRF_COOKIE_NAME],
    )
    return true
  }
}
