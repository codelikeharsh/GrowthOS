import { apiEnvironmentSchema, parseEnvironment, type ApiEnvironment } from '@growthos/config'

let environment: ApiEnvironment | undefined

export function getApiEnvironment(): ApiEnvironment {
  environment ??= parseEnvironment(apiEnvironmentSchema, process.env)
  return environment
}

export function setApiEnvironmentForTest(value: ApiEnvironment | undefined): void {
  environment = value
}
