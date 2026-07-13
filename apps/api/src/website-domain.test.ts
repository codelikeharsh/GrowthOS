import { describe, expect, it } from 'vitest'
import { normalizeWebsiteUrl } from './phase3-domain.js'

describe('website registration domain rules', () => {
  it('normalizes scheme, host, default port, and fragment without network access', () => {
    expect(normalizeWebsiteUrl(' HTTPS://Example.COM:443/path#fragment ')).toBe(
      'https://example.com/path',
    )
  })

  it('preserves an explicit path and query while producing an absolute URL', () => {
    expect(normalizeWebsiteUrl('http://Example.com/pricing?plan=pro')).toBe(
      'http://example.com/pricing?plan=pro',
    )
  })

  it('rejects non-web protocols and embedded credentials', () => {
    expect(() => normalizeWebsiteUrl('mailto:owner@example.com')).toThrow()
    expect(() => normalizeWebsiteUrl('https://user:secret@example.com')).toThrow()
  })
})
