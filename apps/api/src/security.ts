import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import * as argon2 from 'argon2'
import { BadRequestException } from '@nestjs/common'

const passwordRules = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/]

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function validatePassword(password: string): void {
  if (
    password.length < 12 ||
    password.length > 128 ||
    passwordRules.some((rule) => !rule.test(password))
  ) {
    throw new BadRequestException(
      'Password must be 12-128 characters and include lowercase, uppercase, number, and symbol characters',
    )
  }
}

export async function hashPassword(password: string): Promise<string> {
  validatePassword(password)
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  })
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password)
  } catch {
    return false
  }
}

export function createOpaqueToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function tokensMatch(rawToken: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashToken(rawToken), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function slugifyOrganizationName(name: string): string {
  const slug = name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
  if (!slug) throw new BadRequestException('Organization name must contain letters or numbers')
  return slug
}
