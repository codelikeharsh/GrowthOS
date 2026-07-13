import pino, { type Logger, type LoggerOptions } from 'pino'

const sensitivePaths = [
  'password',
  'token',
  'authorization',
  'cookie',
  'req.headers.authorization',
  'req.headers.cookie',
  '*.password',
  '*.token',
  '*.secret',
  '*.apiKey',
]

export function loggerOptions(service: string, level = 'info'): LoggerOptions {
  return {
    base: { service },
    level,
    redact: { paths: sensitivePaths, censor: '[REDACTED]' },
    timestamp: pino.stdTimeFunctions.isoTime,
  }
}

export function createLogger(service: string, level = 'info'): Logger {
  return pino(loggerOptions(service, level))
}
