import { apiEnvironmentSchema, parseEnvironment, type ApiEnvironment } from '@growthos/config'

let environment: ApiEnvironment | undefined

export function getApiEnvironment(): ApiEnvironment {
  environment ??= parseEnvironment(apiEnvironmentSchema, {
    ...process.env,
    API_PORT: process.env.PORT ?? process.env.API_PORT,
    PUBLIC_WEB_URL: process.env.WEB_APP_URL ?? process.env.PUBLIC_WEB_URL,
    SMTP_HOST: process.env.SMTP_HOST ?? process.env.MAILPIT_SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT ?? process.env.MAILPIT_SMTP_PORT,
  })
  return environment
}

export function setApiEnvironmentForTest(value: ApiEnvironment | undefined): void {
  environment = value
}
