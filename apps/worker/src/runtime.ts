import { Worker, type Processor } from 'bullmq'
import { Redis } from 'ioredis'
import type { WorkerEnvironment } from '@growthos/config'

export type WorkerHealth = 'starting' | 'ready' | 'stopping' | 'stopped' | 'unhealthy'

interface CloseableWorker {
  close(): Promise<void>
}

export interface RuntimeLogger {
  info(message: string): void
  error(bindings: object, message: string): void
}

export interface SafeJobFailure {
  jobId: string | undefined
  jobName: string
  errorClass: string
}

export function safeJobFailure(
  job: { id: string | undefined; name: string },
  error: unknown,
): SafeJobFailure {
  return {
    jobId: job.id,
    jobName: job.name,
    errorClass: error instanceof Error ? error.name : 'UnknownError',
  }
}

export class WorkerRuntime {
  private readonly redis: Redis
  private readonly workers: CloseableWorker[] = []
  private state: WorkerHealth = 'starting'

  constructor(
    private readonly environment: WorkerEnvironment,
    private readonly logger: RuntimeLogger,
  ) {
    this.redis = new Redis(environment.REDIS_URL, {
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    })
    this.redis.on('error', (error) => {
      this.state = 'unhealthy'
      this.logger.error({ errorClass: error.name }, 'worker Redis connection failed')
    })
  }

  get health(): WorkerHealth {
    return this.state
  }

  async start(): Promise<void> {
    if (this.redis.status === 'wait') await this.redis.connect()
    await this.redis.ping()
    this.state = 'ready'
    this.logger.info('worker infrastructure is ready; no product job processors are registered')
  }

  registerProcessor<DataType>(queueName: string, processor: Processor<DataType>): Worker<DataType> {
    const redisUrl = new URL(this.environment.REDIS_URL)
    const connection = {
      host: redisUrl.hostname,
      port: Number(redisUrl.port || 6379),
      db: Number(redisUrl.pathname.slice(1) || 0),
      ...(redisUrl.username ? { username: redisUrl.username } : {}),
      ...(redisUrl.password ? { password: redisUrl.password } : {}),
    }
    const worker = new Worker<DataType>(queueName, processor, {
      connection,
    })
    worker.on('failed', (job, error) => {
      this.logger.error(
        safeJobFailure({ id: job?.id, name: job?.name ?? queueName }, error),
        'job failed',
      )
    })
    this.workers.push(worker)
    return worker
  }

  async stop(): Promise<void> {
    if (this.state === 'stopped') return
    this.state = 'stopping'
    await Promise.all(this.workers.map(async (worker) => worker.close()))
    if (this.redis.status === 'ready') await this.redis.quit()
    else this.redis.disconnect()
    this.state = 'stopped'
    this.logger.info('worker stopped')
  }
}
