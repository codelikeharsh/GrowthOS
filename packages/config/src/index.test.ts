import { describe, expect, it } from 'vitest'
import { apiEnvironmentSchema, parseEnvironment, workerEnvironmentSchema } from './index.js'

describe('environment schemas', () => {
  it('parses valid API configuration', () => {
    const value = parseEnvironment(apiEnvironmentSchema, {
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      REDIS_URL: 'redis://localhost:6379',
      API_CORS_ORIGINS: 'http://localhost:3000, https://example.test',
    })
    expect(value.API_CORS_ORIGINS).toEqual(['http://localhost:3000', 'https://example.test'])
    expect(value.OPENAPI_ENABLED).toBe(false)
  })

  it('rejects missing database configuration without leaking values', () => {
    expect(() =>
      parseEnvironment(apiEnvironmentSchema, { REDIS_URL: 'redis://localhost:6379' }),
    ).toThrow('Invalid environment configuration')
  })

  it('rejects a non-Redis worker URL', () => {
    expect(() =>
      parseEnvironment(workerEnvironmentSchema, { REDIS_URL: 'https://example.test' }),
    ).toThrow('REDIS_URL')
  })
})
