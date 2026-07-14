import {
  auditOrchestrationQueueName,
  type AuditOrchestrationPayload,
  type WorkerEnvironment,
} from '@growthos/config'
import { AuditOrchestrationConsumer } from './audit-orchestration.js'
import type { AuditWorkerLogger } from './audit-orchestration.js'
import type { SecurePageFetcher } from './secure-homepage-fetcher.js'
import type { PerformanceProvider } from './performance-provider.js'
import { WorkerRuntime, type RuntimeLogger } from './runtime.js'

export interface WorkerBootstrapDependencies {
  environment: WorkerEnvironment
  logger: RuntimeLogger & AuditWorkerLogger
  fetcher: SecurePageFetcher
  performanceProvider?: PerformanceProvider
  runtime?: WorkerRuntime
}

export function bootstrapWorker(dependencies: WorkerBootstrapDependencies): WorkerRuntime {
  const runtime =
    dependencies.runtime ?? new WorkerRuntime(dependencies.environment, dependencies.logger)
  const consumer = new AuditOrchestrationConsumer(
    dependencies.fetcher,
    dependencies.logger,
    undefined,
    dependencies.performanceProvider,
  )
  runtime.registerProcessor<AuditOrchestrationPayload>(auditOrchestrationQueueName, async (job) => {
    await consumer.process(job.data, job.id)
  })
  return runtime
}
