import { randomUUID } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import {
  RequestMethod,
  ValidationPipe,
  VersioningType,
  type INestApplication,
} from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import helmet from '@fastify/helmet'
import cookie from '@fastify/cookie'
import { loggerOptions } from '@growthos/logger'
import { AppModule } from './app.module.js'
import { getApiEnvironment } from './environment.js'
import { SafeHttpExceptionFilter } from './http-exception.filter.js'

export async function createApplication(module = AppModule): Promise<NestFastifyApplication> {
  const environment = getApiEnvironment()
  const adapter = new FastifyAdapter({
    bodyLimit: 1_048_576,
    genReqId: (request: IncomingMessage) => {
      const supplied = request.headers['x-request-id']
      return typeof supplied === 'string' && supplied.length <= 128 ? supplied : randomUUID()
    },
    logger: loggerOptions('api', environment.LOG_LEVEL),
  })
  const app = await NestFactory.create<NestFastifyApplication>(module, adapter, {
    bufferLogs: false,
    logger: false,
  })

  await app.register(cookie)
  await app.register(helmet)
  app.enableCors({
    credentials: true,
    origin: environment.API_CORS_ORIGINS,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
  app.setGlobalPrefix('api', { exclude: [{ path: '/', method: RequestMethod.GET }] })
  app.enableVersioning({ type: VersioningType.URI })
  app.useGlobalPipes(
    new ValidationPipe({ forbidNonWhitelisted: true, transform: true, whitelist: true }),
  )
  app.useGlobalFilters(new SafeHttpExceptionFilter())
  app.enableShutdownHooks()

  adapter.getInstance().addHook('onRequest', (request, reply, done) => {
    const correlation = request.headers['x-correlation-id']
    reply.header('x-request-id', request.id)
    reply.header(
      'x-correlation-id',
      typeof correlation === 'string' && correlation.length <= 128 ? correlation : request.id,
    )
    done()
  })

  if (environment.OPENAPI_ENABLED) configureOpenApi(app)
  return app
}

function configureOpenApi(app: INestApplication): void {
  const config = new DocumentBuilder().setTitle('zero2one Growth OS API').setVersion('1').build()
  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api/docs', app, document)
}
