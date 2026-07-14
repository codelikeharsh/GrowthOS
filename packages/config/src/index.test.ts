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
    expect(value.SMTP_SECURE).toBe(false)
  })

  it('requires both SMTP credentials when either is configured', () => {
    expect(() =>
      parseEnvironment(apiEnvironmentSchema, {
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        REDIS_URL: 'redis://localhost:6379',
        SMTP_USER: 'smtp-user',
      }),
    ).toThrow('SMTP_USER and SMTP_PASSWORD must be configured together')
  })

  it('requires a Resend API key only for the Resend provider', () => {
    expect(() =>
      parseEnvironment(apiEnvironmentSchema, {
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        REDIS_URL: 'redis://localhost:6379',
        EMAIL_PROVIDER: 'resend',
      }),
    ).toThrow('RESEND_API_KEY is required')
    expect(
      parseEnvironment(apiEnvironmentSchema, {
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        REDIS_URL: 'redis://localhost:6379',
        EMAIL_PROVIDER: 'resend',
        RESEND_API_KEY: 're_test_key',
      }).EMAIL_PROVIDER,
    ).toBe('resend')
  })

  it('rejects development web and SMTP defaults in production', () => {
    expect(() =>
      parseEnvironment(apiEnvironmentSchema, {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://user:pass@postgres.internal:5432/db',
        REDIS_URL: 'redis://redis.internal:6379',
      }),
    ).toThrow('PUBLIC_WEB_URL must use HTTPS in production')
  })

  it('rejects missing database configuration without leaking values', () => {
    expect(() =>
      parseEnvironment(apiEnvironmentSchema, { REDIS_URL: 'redis://localhost:6379' }),
    ).toThrow('Invalid environment configuration')
  })

  it('rejects a non-Redis worker URL', () => {
    expect(() =>
      parseEnvironment(workerEnvironmentSchema, {
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        REDIS_URL: 'https://example.test',
      }),
    ).toThrow('REDIS_URL')
  })
})
