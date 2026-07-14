const { randomBytes } = require('node:crypto')

const bytes = Number.parseInt(process.argv[2] ?? '48', 10)

if (!Number.isInteger(bytes) || bytes < 32 || bytes > 1024) {
  throw new Error('Secret length must be an integer between 32 and 1024 bytes')
}

process.stdout.write(`${randomBytes(bytes).toString('base64url')}\n`)
