import { parseEnvironment, workerEnvironmentSchema } from '@growthos/config'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { WorkerRuntime, type RuntimeLogger } from './runtime.js'

const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true'
const environment = parseEnvironment(workerEnvironmentSchema, {
  DATABASE_URL:
    process.env.DATABASE_URL ?? 'postgresql://growthos:development@localhost:5432/growthos',
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
})
const logger: RuntimeLogger = {
  info: vi.fn(),
  error: vi.fn(),
}
const runtime = new WorkerRuntime(environment, logger)

describe.skipIf(!runIntegration)('Redis connectivity integration', () => {
  afterAll(async () => runtime.stop())
  it('reaches ready state after a real Redis ping', async () => {
    await runtime.start()
    expect(runtime.health).toBe('ready')
  })
})
