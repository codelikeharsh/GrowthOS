import { describe, expect, it } from 'vitest'
import {
  createOpaqueToken,
  hashPassword,
  hashToken,
  normalizeEmail,
  tokensMatch,
  validatePassword,
  verifyPassword,
} from './security.js'

describe('Phase 2 security primitives', () => {
  it('normalizes email identity consistently', () => {
    expect(normalizeEmail('  User@Example.COM ')).toBe('user@example.com')
  })

  it('enforces the strong password baseline', () => {
    expect(() => {
      validatePassword('short')
    }).toThrow(/12-128/)
    expect(() => {
      validatePassword('LongButNoSymbol42')
    }).toThrow(/12-128/)
    expect(() => {
      validatePassword('StrongPassword!42')
    }).not.toThrow()
  })

  it('hashes and verifies passwords with Argon2id', async () => {
    const hash = await hashPassword('StrongPassword!42')
    expect(hash).toMatch(/^\$argon2id\$/)
    await expect(verifyPassword(hash, 'StrongPassword!42')).resolves.toBe(true)
    await expect(verifyPassword(hash, 'WrongPassword!42')).resolves.toBe(false)
  })

  it('creates high-entropy opaque tokens and stores deterministic SHA-256 hashes', () => {
    const first = createOpaqueToken()
    const second = createOpaqueToken()
    expect(first).not.toBe(second)
    expect(hashToken(first)).toHaveLength(64)
    expect(hashToken(first)).not.toContain(first)
  })

  it('compares a raw token against its stored hash', () => {
    const token = createOpaqueToken()
    expect(tokensMatch(token, hashToken(token))).toBe(true)
    expect(tokensMatch(createOpaqueToken(), hashToken(token))).toBe(false)
  })
})
