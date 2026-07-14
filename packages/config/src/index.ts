import { z } from 'zod'

const booleanFromString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true')

const optionalString = z.string().trim().min(1).optional()

const commonSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
})

export const apiEnvironmentSchema = commonSchema
  .extend({
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
    AI_SERVICE_URL: z.url().optional(),
    SESSION_COOKIE_NAME: z.string().min(1).default('growthos_session'),
    CSRF_COOKIE_NAME: z.string().min(1).default('growthos_csrf'),
    SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(168),
    EMAIL_VERIFICATION_TTL_MINUTES: z.coerce.number().int().min(5).max(1440).default(60),
    PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(1440).default(30),
    INVITATION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(72),
    LOGIN_RATE_LIMIT: z.coerce.number().int().min(1).max(100).default(5),
    PASSWORD_RESET_RATE_LIMIT: z.coerce.number().int().min(1).max(100).default(5),
    AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(10).max(86_400).default(900),
    EMAIL_VERIFICATION_RESEND_RATE_LIMIT: z.coerce.number().int().min(1).max(100).default(3),
    EMAIL_DELIVERY_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(10_000),
    EMAIL_PROVIDER: z.enum(['smtp', 'resend']).default('smtp'),
    RESEND_API_KEY: optionalString,
    SMTP_HOST: z.string().min(1).default('localhost'),
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(1025),
    SMTP_SECURE: booleanFromString,
    SMTP_USER: optionalString,
    SMTP_PASSWORD: optionalString,
    MAIL_FROM: z.email().default('no-reply@growthos.local'),
    OPENAPI_ENABLED: booleanFromString,
  })
  .superRefine((environment, context) => {
    if (
      environment.EMAIL_PROVIDER === 'smtp' &&
      Boolean(environment.SMTP_USER) !== Boolean(environment.SMTP_PASSWORD)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['SMTP_PASSWORD'],
        message: 'SMTP_USER and SMTP_PASSWORD must be configured together',
      })
    }
    if (environment.EMAIL_PROVIDER === 'resend' && !environment.RESEND_API_KEY) {
      context.addIssue({
        code: 'custom',
        path: ['RESEND_API_KEY'],
        message: 'RESEND_API_KEY is required when EMAIL_PROVIDER is resend',
      })
    }
    if (environment.NODE_ENV !== 'production') return
    if (new URL(environment.PUBLIC_WEB_URL).protocol !== 'https:') {
      context.addIssue({
        code: 'custom',
        path: ['PUBLIC_WEB_URL'],
        message: 'PUBLIC_WEB_URL must use HTTPS in production',
      })
    }
    if (environment.API_CORS_ORIGINS.some((origin) => new URL(origin).protocol !== 'https:')) {
      context.addIssue({
        code: 'custom',
        path: ['API_CORS_ORIGINS'],
        message: 'API_CORS_ORIGINS must contain only HTTPS origins in production',
      })
    }
    if (
      environment.EMAIL_PROVIDER === 'smtp' &&
      (environment.SMTP_HOST === 'localhost' || environment.SMTP_HOST === '127.0.0.1')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['SMTP_HOST'],
        message: 'SMTP_HOST must be an external SMTP provider in production',
      })
    }
  })

export const workerEnvironmentSchema = commonSchema.extend({
  DATABASE_URL: z.string().startsWith('postgresql://'),
  REDIS_URL: z.string().startsWith('redis://'),
  // No live provider is selectable yet. Keeping this explicit prevents a
  // deployment from silently enabling arbitrary outbound measurements.
  PERFORMANCE_PROVIDER: z.literal('disabled').default('disabled'),
})

export type ApiEnvironment = z.infer<typeof apiEnvironmentSchema>
export type WorkerEnvironment = z.infer<typeof workerEnvironmentSchema>

export const auditOrchestrationQueueName = 'audit-orchestration'
export const auditOrchestrationJobName = 'audit-orchestration.requested'
export interface AuditOrchestrationPayload {
  auditRunId: string
  websiteId: string
  organizationId: string
}

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
