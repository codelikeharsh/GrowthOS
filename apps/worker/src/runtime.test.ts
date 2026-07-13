import { parseEnvironment, workerEnvironmentSchema } from '@growthos/config'
import { describe, expect, it, vi } from 'vitest'
import { safeJobFailure, WorkerRuntime, type RuntimeLogger } from './runtime.js'

const logger: RuntimeLogger = { info: vi.fn(), error: vi.fn() }

describe('worker foundation', () => {
  it('validates Redis configuration', () => {
    expect(() => parseEnvironment(workerEnvironmentSchema, { REDIS_URL: 'invalid' })).toThrow(
      'REDIS_URL',
    )
  })

  it('logs failed-job metadata without payload data', () => {
    const metadata = safeJobFailure(
      { id: 'job-1', name: 'infrastructure-test' },
      new Error('contains private payload'),
    )
    expect(metadata).toEqual({
      jobId: 'job-1',
      jobName: 'infrastructure-test',
      errorClass: 'Error',
    })
    expect(JSON.stringify(metadata)).not.toContain('private payload')
  })

  it('supports idempotent graceful shutdown before a connection starts', async () => {
    const environment = parseEnvironment(workerEnvironmentSchema, {
      REDIS_URL: 'redis://localhost:6379',
    })
    const runtime = new WorkerRuntime(environment, logger)
    await runtime.stop()
    await runtime.stop()
    expect(runtime.health).toBe('stopped')
  })
})
