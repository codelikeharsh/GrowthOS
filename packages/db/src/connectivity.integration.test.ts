import { afterAll, describe, expect, it } from 'vitest'
import { checkDatabaseConnection, disconnectDatabase } from './index.js'

const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true'

describe.skipIf(!runIntegration)('PostgreSQL connectivity integration', () => {
  afterAll(disconnectDatabase)

  it('executes a bounded connectivity query', async () => {
    await expect(checkDatabaseConnection()).resolves.toBeUndefined()
  })
})
