import { HttpException, HttpStatus, Injectable, type OnApplicationShutdown } from '@nestjs/common'
import { Redis } from 'ioredis'
import { getApiEnvironment } from './environment.js'
import { hashToken } from './security.js'

interface LocalCounter {
  count: number
  expiresAt: number
}

@Injectable()
export class RateLimitService implements OnApplicationShutdown {
  private readonly environment = getApiEnvironment()
  private readonly local = new Map<string, LocalCounter>()
  private redis: Redis | undefined

  async consume(scope: string, identity: string, limit: number): Promise<void> {
    const key = `growthos:rate:${scope}:${hashToken(identity)}`
    const count = await this.consumeRedis(key).catch(() => this.consumeLocal(key))
    if (count > limit) {
      throw new HttpException('Too many requests. Try again later.', HttpStatus.TOO_MANY_REQUESTS)
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.redis?.status === 'ready') await this.redis.quit()
    else this.redis?.disconnect()
  }

  private async consumeRedis(key: string): Promise<number> {
    if (!this.redis || this.redis.status === 'end') {
      this.redis = new Redis(this.environment.REDIS_URL, {
        enableOfflineQueue: false,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      })
    }
    if (this.redis.status === 'wait') await this.redis.connect()
    const transaction = this.redis
      .multi()
      .incr(key)
      .expire(key, this.environment.AUTH_RATE_LIMIT_WINDOW_SECONDS)
    const result = await transaction.exec()
    const count = result?.[0]?.[1]
    if (typeof count !== 'number') throw new Error('Redis rate-limit response was invalid')
    return count
  }

  private consumeLocal(key: string): number {
    const now = Date.now()
    const current = this.local.get(key)
    if (!current || current.expiresAt <= now) {
      this.local.set(key, {
        count: 1,
        expiresAt: now + this.environment.AUTH_RATE_LIMIT_WINDOW_SECONDS * 1000,
      })
      return 1
    }
    current.count += 1
    return current.count
  }
}
