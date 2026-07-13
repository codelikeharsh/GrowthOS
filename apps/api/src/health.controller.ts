import { Controller, Get, HttpCode, Inject, Res } from '@nestjs/common'
import type { FastifyReply } from 'fastify'
import { DependenciesService, type DependencyState } from './dependencies.service.js'

interface HealthResponse {
  status: 'ok' | 'unavailable'
  service: 'api'
  timestamp: string
  dependencies?: DependencyState
}

@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(@Inject(DependenciesService) private readonly dependencies: DependenciesService) {}

  @Get('live')
  @HttpCode(200)
  live(): HealthResponse {
    return { status: 'ok', service: 'api', timestamp: new Date().toISOString() }
  }

  @Get('ready')
  async ready(@Res() reply: FastifyReply): Promise<void> {
    const dependencies = await this.dependencies.check()
    const ready = Object.values(dependencies).every((state) => state === 'up')
    await reply.status(ready ? 200 : 503).send({
      status: ready ? 'ok' : 'unavailable',
      service: 'api',
      timestamp: new Date().toISOString(),
      dependencies,
    } satisfies HealthResponse)
  }
}
