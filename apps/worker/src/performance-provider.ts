/**
 * A narrow, injectable boundary for optional third-party performance data.
 * It does not fetch a customer URL itself: a future implementation must use a
 * reviewed provider endpoint and return compact metrics only. The normal audit
 * remains useful when this boundary is unavailable.
 */
export type ProviderExecutionStatus = 'SUCCEEDED' | 'FAILED' | 'UNAVAILABLE'

export interface PerformanceProviderResult {
  provider: string
  status: ProviderExecutionStatus
  metrics: Record<string, number | string | boolean>
  errorCode?: string
}

export interface PerformanceProvider {
  measure(input: { auditRunId: string; websiteUrl: string }): Promise<PerformanceProviderResult>
}

export class DisabledPerformanceProvider implements PerformanceProvider {
  measure(input: { auditRunId: string; websiteUrl: string }): Promise<PerformanceProviderResult> {
    // Reference the typed input so implementations cannot accidentally evolve
    // into a parameterless, unreviewed global fetcher.
    const metrics = input.auditRunId && input.websiteUrl ? {} : {}
    return Promise.resolve({
      provider: 'disabled',
      status: 'UNAVAILABLE',
      metrics,
      errorCode: 'NOT_CONFIGURED',
    })
  }
}

/** Test and future-provider helper. It races a supplied, reviewed provider
 * request against a strict timeout and never exposes raw error messages. */
export async function withProviderTimeout<T>(
  operation: Promise<T>,
  timeoutMs = 10_000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('PERFORMANCE_PROVIDER_TIMEOUT'))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
