import { afterAll, describe, expect, it } from 'vitest'
import { DependenciesService } from './dependencies.service.js'
import { setApiEnvironmentForTest } from './environment.js'

const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true'

describe.skipIf(!runIntegration)('API dependency integration', () => {
  const service = new DependenciesService()
  afterAll(async () => {
    await service.onApplicationShutdown()
    setApiEnvironmentForTest(undefined)
  })

  it('connects to real PostgreSQL and Redis services', async () => {
    const state = await service.check()
    expect(state).toEqual({ postgresql: 'up', redis: 'up' })
  })
})
