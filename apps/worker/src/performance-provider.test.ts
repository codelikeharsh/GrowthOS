import { describe, expect, it, vi } from 'vitest'
import { DisabledPerformanceProvider, withProviderTimeout } from './performance-provider.js'

describe('optional performance provider boundary', () => {
  it('is explicitly unavailable by default without making a network request', async () => {
    const provider = new DisabledPerformanceProvider()
    await expect(
      provider.measure({ auditRunId: 'audit', websiteUrl: 'https://example.test/' }),
    ).resolves.toEqual({
      provider: 'disabled',
      status: 'UNAVAILABLE',
      metrics: {},
      errorCode: 'NOT_CONFIGURED',
    })
  })

  it('enforces the provider timeout without exposing the operation error', async () => {
    vi.useFakeTimers()
    const result = withProviderTimeout(new Promise<never>(() => undefined), 25)
    const assertion = expect(result).rejects.toThrow('PERFORMANCE_PROVIDER_TIMEOUT')
    await vi.advanceTimersByTimeAsync(25)
    await assertion
    vi.useRealTimers()
  })
})
