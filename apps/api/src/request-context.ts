import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'

export interface RequestMetadata {
  ipAddress: string
  requestId: string
  userAgent: string | undefined
}

export interface AuthContext {
  sessionId: string
  userId: string
  email: string
  displayName: string
  csrfHash: string
  rawSessionToken: string
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext
  }
}

export function getRequestMetadata(request: FastifyRequest): RequestMetadata {
  const userAgent = request.headers['user-agent']
  return {
    ipAddress: request.ip,
    requestId: request.id,
    userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 512) : undefined,
  }
}

export const CurrentAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext => {
    const request = context.switchToHttp().getRequest<FastifyRequest>()
    if (!request.auth) throw new Error('Authentication guard did not provide a context')
    return request.auth
  },
)
