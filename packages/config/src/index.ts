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
  PUBLIC_WEB_URL: z.url().default('http://localhost:3000'),
  SESSION_COOKIE_NAME: z.string().min(1).default('growthos_session'),
  CSRF_COOKIE_NAME: z.string().min(1).default('growthos_csrf'),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(168),
  EMAIL_VERIFICATION_TTL_MINUTES: z.coerce.number().int().min(5).max(1440).default(60),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(1440).default(30),
  INVITATION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(72),
  LOGIN_RATE_LIMIT: z.coerce.number().int().min(1).max(100).default(5),
  PASSWORD_RESET_RATE_LIMIT: z.coerce.number().int().min(1).max(100).default(5),
  AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(10).max(86_400).default(900),
  MAILPIT_SMTP_HOST: z.string().min(1).default('localhost'),
  MAILPIT_SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(1025),
  MAIL_FROM: z.email().default('no-reply@growthos.local'),
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
