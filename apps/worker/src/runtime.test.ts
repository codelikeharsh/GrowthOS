import { parseEnvironment, workerEnvironmentSchema } from '@growthos/config'
import { describe, expect, it, vi } from 'vitest'
import { safeJobFailure, WorkerRuntime, type RuntimeLogger } from './runtime.js'
import { auditOrchestrationJobName, auditOrchestrationQueueName } from '@growthos/config'

const logger: RuntimeLogger = { info: vi.fn(), error: vi.fn() }

describe('worker foundation', () => {
  it('validates Redis configuration', () => {
    expect(() =>
      parseEnvironment(workerEnvironmentSchema, {
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        REDIS_URL: 'invalid',
      }),
    ).toThrow('REDIS_URL')
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
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      REDIS_URL: 'redis://localhost:6379',
    })
    const runtime = new WorkerRuntime(environment, logger)
    await runtime.stop()
    await runtime.stop()
    expect(runtime.health).toBe('stopped')
  })

  it('shares the typed audit orchestration queue contract without registering a crawler', () => {
    expect(auditOrchestrationQueueName).toBe('audit-orchestration')
    expect(auditOrchestrationJobName).toBe('audit-orchestration.requested')
  })
})
