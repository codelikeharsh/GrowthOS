import {
  auditOrchestrationQueueName,
  parseEnvironment,
  workerEnvironmentSchema,
  type AuditOrchestrationPayload,
} from '@growthos/config'
import { createLogger } from '@growthos/logger'
import { AuditOrchestrationConsumer } from './audit-orchestration.js'
import { WorkerRuntime } from './runtime.js'
import { SafeTargetValidator, SecureHomepageFetcher } from './secure-homepage-fetcher.js'

const environment = parseEnvironment(workerEnvironmentSchema, process.env)
const logger = createLogger('worker', environment.LOG_LEVEL)
const runtime = new WorkerRuntime(environment, logger)
const consumer = new AuditOrchestrationConsumer(
  new SecureHomepageFetcher(new SafeTargetValidator()),
  logger,
)
runtime.registerProcessor<AuditOrchestrationPayload>(auditOrchestrationQueueName, async (job) => {
  await consumer.process(job.data, job.id)
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
