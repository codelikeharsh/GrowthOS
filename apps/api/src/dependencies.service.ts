import { Injectable, type OnApplicationShutdown } from '@nestjs/common'
import { checkDatabaseConnection, disconnectDatabase } from '@growthos/db'
import { Redis } from 'ioredis'
import { getApiEnvironment } from './environment.js'

export type DependencyName = 'postgresql' | 'redis'
export type DependencyState = Record<DependencyName, 'up' | 'down'>

@Injectable()
export class DependenciesService implements OnApplicationShutdown {
  private redis: Redis | undefined

  async check(): Promise<DependencyState> {
    const results = await Promise.allSettled([checkDatabaseConnection(), this.checkRedis()])
    return {
      postgresql: results[0].status === 'fulfilled' ? 'up' : 'down',
      redis: results[1].status === 'fulfilled' ? 'up' : 'down',
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await disconnectDatabase()
    if (this.redis?.status === 'ready') await this.redis.quit()
    else this.redis?.disconnect()
  }

  private async checkRedis(): Promise<void> {
    if (!this.redis || this.redis.status === 'end') {
      this.redis = new Redis(getApiEnvironment().REDIS_URL, {
        enableOfflineQueue: false,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      })
    }
    if (this.redis.status === 'wait') await this.redis.connect()
    await this.redis.ping()
  }
}
