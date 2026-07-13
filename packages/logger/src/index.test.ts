import { Writable } from 'node:stream'
import pino from 'pino'
import { describe, expect, it } from 'vitest'
import { loggerOptions } from './index.js'

describe('logger', () => {
  it('redacts common secret fields', async () => {
    let output = ''
    const destination = new Writable({
      write: (chunk, _encoding, done) => {
        output += String(chunk)
        done()
      },
    })
    const logger = pino(loggerOptions('test'), destination)
    logger.info({ token: 'secret', nested: { password: 'hidden' } }, 'safe')
    await new Promise<void>((resolve) => destination.end(resolve))
    expect(output).not.toContain('secret')
    expect(output).not.toContain('hidden')
    expect(output).toContain('[REDACTED]')
  })
})
