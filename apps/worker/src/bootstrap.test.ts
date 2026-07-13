import {
  auditOrchestrationQueueName,
  parseEnvironment,
  workerEnvironmentSchema,
} from '@growthos/config'
import { describe, expect, it, vi } from 'vitest'
import { bootstrapWorker } from './bootstrap.js'
import type { WorkerRuntime } from './runtime.js'

describe('worker bootstrap composition', () => {
  it('registers the audit queue with an explicitly injected fetcher only', () => {
    const registerProcessor = vi.fn()
    const runtime = { registerProcessor } as unknown as WorkerRuntime
    const fetcher = { fetch: vi.fn() }
    const logger = { info: vi.fn(), error: vi.fn() }
    const environment = parseEnvironment(workerEnvironmentSchema, {
      REDIS_URL: 'redis://localhost:6379',
    })
    expect(bootstrapWorker({ environment, logger, fetcher, runtime })).toBe(runtime)
    expect(registerProcessor).toHaveBeenCalledWith(
      auditOrchestrationQueueName,
      expect.any(Function),
    )
  })
})
