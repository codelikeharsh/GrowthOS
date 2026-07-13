import { z } from 'zod'

const webEnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  WEB_PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
})

export function getWebEnvironment() {
  const parsed = webEnvironmentSchema.safeParse(process.env)
  if (!parsed.success) {
    throw new Error(
      `Invalid web environment: ${parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')}`,
    )
  }
  return parsed.data
}
