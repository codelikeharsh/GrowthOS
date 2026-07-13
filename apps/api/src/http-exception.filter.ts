import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { createLogger } from '@growthos/logger'
import { getApiEnvironment } from './environment.js'

@Catch()
export class SafeHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = createLogger('api', getApiEnvironment().LOG_LEVEL)

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp()
    const request = context.getRequest<FastifyRequest>()
    const reply = context.getResponse<FastifyReply>()
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR
    const publicMessage = status >= 500 ? 'Internal server error' : this.getPublicMessage(exception)

    this.logger.error(
      {
        requestId: request.id,
        method: request.method,
        path: request.url,
        status,
        errorClass: exception instanceof Error ? exception.name : 'UnknownError',
      },
      'request failed',
    )
    void reply.status(status).send({
      statusCode: status,
      error: status >= 500 ? 'Internal Server Error' : 'Request Error',
      message: publicMessage,
      requestId: request.id,
      timestamp: new Date().toISOString(),
    })
  }

  private getPublicMessage(exception: unknown): string {
    if (!(exception instanceof HttpException)) return 'Request failed'
    const response = exception.getResponse()
    if (typeof response === 'string') return response
    if (typeof response === 'object' && 'message' in response) {
      const message = response.message
      return Array.isArray(message) ? message.join(', ') : String(message)
    }
    return exception.message
  }
}
