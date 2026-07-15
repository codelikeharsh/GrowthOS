import { Controller, Get, Module } from '@nestjs/common'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApplication } from './app.js'
import { DependenciesService, type DependencyState } from './dependencies.service.js'
import { HealthController } from './health.controller.js'
import { setApiEnvironmentForTest } from './environment.js'

@Controller({ path: 'failure', version: '1' })
class FailureController {
  @Get()
  fail(): never {
    throw new Error('internal detail must stay private')
  }
}

const dependencyMock = {
  check: vi.fn<() => Promise<DependencyState>>(),
  onApplicationShutdown: vi.fn(),
}

@Module({
  controllers: [HealthController, FailureController],
  providers: [{ provide: DependenciesService, useValue: dependencyMock }],
})
// Test-only NestJS module; behavior is declared through decorator metadata.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class TestModule {}

describe('API HTTP foundation', () => {
  let app: NestFastifyApplication
  const check = dependencyMock.check

  beforeEach(async () => {
    setApiEnvironmentForTest({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      API_PORT: 3001,
      API_CORS_ORIGINS: ['http://localhost:3000'],
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/test',
      REDIS_URL: 'redis://localhost:6379',
      PUBLIC_WEB_URL: 'http://localhost:3000',
      SESSION_COOKIE_NAME: 'growthos_session',
      CSRF_COOKIE_NAME: 'growthos_csrf',
      SESSION_TTL_HOURS: 168,
      EMAIL_VERIFICATION_TTL_MINUTES: 60,
      PASSWORD_RESET_TTL_MINUTES: 30,
      INVITATION_TTL_HOURS: 72,
      LOGIN_RATE_LIMIT: 5,
      PASSWORD_RESET_RATE_LIMIT: 5,
      AUTH_RATE_LIMIT_WINDOW_SECONDS: 900,
      EMAIL_VERIFICATION_RESEND_RATE_LIMIT: 3,
      EMAIL_DELIVERY_TIMEOUT_MS: 1_000,
      EMAIL_PROVIDER: 'smtp',
      RESEND_API_KEY: undefined,
      SMTP_HOST: 'localhost',
      SMTP_PORT: 1025,
      SMTP_SECURE: false,
      MAIL_FROM: 'no-reply@growthos.local',
      OPENAPI_ENABLED: false,
    })
    app = await createApplication(TestModule)
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  afterEach(async () => {
    await app.close()
    vi.clearAllMocks()
    setApiEnvironmentForTest(undefined)
  })

  it('returns liveness and a request ID', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health/live' })
    expect(response.statusCode, response.body).toBe(200)
    expect(response.headers['x-request-id']).toBeTruthy()
    expect(response.json()).toMatchObject({ status: 'ok', service: 'api' })
  })

  it('returns readiness success when critical dependencies are up', async () => {
    check.mockResolvedValue({ postgresql: 'up', redis: 'up' })
    const response = await app.inject({ method: 'GET', url: '/api/v1/health/ready' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      status: 'ok',
      dependencies: { postgresql: 'up', redis: 'up' },
    })
  })

  it('returns 503 when a critical dependency is down', async () => {
    check.mockResolvedValue({ postgresql: 'up', redis: 'down' })
    const response = await app.inject({ method: 'GET', url: '/api/v1/health/ready' })
    expect(response.statusCode, response.body).toBe(503)
    expect(response.json()).toMatchObject({ status: 'unavailable' })
  })

  it('does not expose internal error details', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/failure' })
    expect(response.statusCode).toBe(500)
    expect(response.body).not.toContain('internal detail')
    expect(response.json()).toMatchObject({ message: 'Internal server error' })
  })

  it('allows credentials only for the configured web origin', async () => {
    const allowed = await app.inject({
      method: 'GET',
      url: '/api/v1/health/live',
      headers: { origin: 'http://localhost:3000' },
    })
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000')
    expect(allowed.headers['access-control-allow-credentials']).toBe('true')
    const denied = await app.inject({
      method: 'GET',
      url: '/api/v1/health/live',
      headers: { origin: 'https://invalid.example' },
    })
    expect(denied.headers['access-control-allow-origin']).toBeUndefined()
  })
})
