import { z } from 'zod'

const booleanFromString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true')

const commonSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
})

export const apiEnvironmentSchema = commonSchema.extend({
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  API_CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  DATABASE_URL: z.string().startsWith('postgresql://'),
  REDIS_URL: z.string().startsWith('redis://'),
  OPENAPI_ENABLED: booleanFromString,
})

export const workerEnvironmentSchema = commonSchema.extend({
  REDIS_URL: z.string().startsWith('redis://'),
})

export type ApiEnvironment = z.infer<typeof apiEnvironmentSchema>
export type WorkerEnvironment = z.infer<typeof workerEnvironmentSchema>

export function parseEnvironment<T>(schema: z.ZodType<T>, environment: NodeJS.ProcessEnv): T {
  const result = schema.safeParse(environment)
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new Error(`Invalid environment configuration: ${details}`)
  }
  return result.data
}
