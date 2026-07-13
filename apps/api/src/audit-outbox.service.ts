import {
  auditOrchestrationJobName,
  auditOrchestrationQueueName,
  type AuditOrchestrationPayload,
} from '@growthos/config'
import { Injectable, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common'
import { Queue } from 'bullmq'
import { getDatabaseClient } from '@growthos/db'
import { getApiEnvironment } from './environment.js'

@Injectable()
export class AuditOutboxDispatcher implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly database = getDatabaseClient()
  private readonly queue: Queue<AuditOrchestrationPayload>

  constructor() {
    const redisUrl = new URL(getApiEnvironment().REDIS_URL)
    this.queue = new Queue<AuditOrchestrationPayload>(auditOrchestrationQueueName, {
      connection: {
        host: redisUrl.hostname,
        port: Number(redisUrl.port || 6379),
        db: Number(redisUrl.pathname.slice(1) || 0),
        ...(redisUrl.username ? { username: redisUrl.username } : {}),
        ...(redisUrl.password ? { password: redisUrl.password } : {}),
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1_000 },
        removeOnComplete: true,
      },
    })
  }

  async dispatch(eventId: string): Promise<boolean> {
    const event = await this.database.outboxEvent.findFirst({
      where: { id: eventId, processedAt: null, attempts: { lt: 3 } },
    })
    if (event?.eventType !== auditOrchestrationJobName) return true
    try {
      const payload = event.payload as unknown as AuditOrchestrationPayload
      await this.queue.add(auditOrchestrationJobName, payload, { jobId: event.id })
      await this.database.outboxEvent.updateMany({
        where: { id: event.id, processedAt: null },
        data: { processedAt: new Date(), attempts: { increment: 1 }, lastError: null },
      })
      return true
    } catch (cause) {
      await this.database.$transaction([
        this.database.outboxEvent.updateMany({
          where: { id: event.id, processedAt: null },
          data: {
            attempts: { increment: 1 },
            lastError: cause instanceof Error ? cause.name : 'UnknownError',
          },
        }),
        this.database.auditLog.create({
          data: {
            action: 'audit.queue_dispatch_failed',
            organizationId: event.organizationId,
            targetType: 'audit_run',
            targetId: event.auditRunId,
          },
        }),
      ])
      return false
    }
  }

  async close(): Promise<void> {
    await this.queue.close()
  }

  async onApplicationBootstrap(): Promise<void> {
    const pending = await this.database.outboxEvent.findMany({
      where: { processedAt: null, attempts: { lt: 3 } },
      orderBy: { createdAt: 'asc' },
      take: 25,
      select: { id: true },
    })
    await Promise.all(pending.map(async (event) => this.dispatch(event.id)))
  }

  async onApplicationShutdown(): Promise<void> {
    await this.close()
  }
}
