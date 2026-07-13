import { parseEnvironment, workerEnvironmentSchema } from '@growthos/config'
import { createLogger } from '@growthos/logger'
import { WorkerRuntime } from './runtime.js'

const environment = parseEnvironment(workerEnvironmentSchema, process.env)
const logger = createLogger('worker', environment.LOG_LEVEL)
const runtime = new WorkerRuntime(environment, logger)

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
