import { parseEnvironment, workerEnvironmentSchema } from '@growthos/config'
import { createLogger } from '@growthos/logger'
import { bootstrapWorker } from './bootstrap.js'
import { SafeTargetValidator, SecureHomepageFetcher } from './secure-homepage-fetcher.js'

const environment = parseEnvironment(workerEnvironmentSchema, process.env)
const logger = createLogger('worker', environment.LOG_LEVEL)
const runtime = bootstrapWorker({
  environment,
  logger,
  fetcher: new SecureHomepageFetcher(new SafeTargetValidator()),
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void runtime.stop().then(() => process.exit(0))
  })
}

try {
  await runtime.start()
} catch (error) {
  logger.fatal(
    { errorClass: error instanceof Error ? error.name : 'UnknownError' },
    'worker failed to start',
  )
  await runtime.stop()
  process.exitCode = 1
}
