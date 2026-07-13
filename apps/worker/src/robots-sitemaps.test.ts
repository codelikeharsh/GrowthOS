import { describe, expect, it } from 'vitest'
import {
  MAX_SITEMAP_FILES,
  MAX_SITEMAP_URLS,
  parseRobots,
  sitemapCandidates,
} from './robots-sitemaps.js'

describe('robots and sitemap discovery', () => {
  it('uses GrowthOS-specific rules and allows a specific path over a broader disallow', () => {
    const policy = parseRobots(
      'User-agent: *\nDisallow: /private\nUser-agent: GrowthOSAuditBot\nAllow: /private/public\nSitemap: /site.xml',
      'https://example.com/',
    )
    expect(policy.allows('https://example.com/private/secret')).toBe(false)
    expect(policy.allows('https://example.com/private/public/page')).toBe(true)
    expect(policy.sitemaps).toEqual(['https://example.com/site.xml'])
  })

  it('handles malformed robots safely and extracts only safe sitemap URLs', () => {
    expect(
      parseRobots('malformed\nDisallow', 'https://example.com/').allows('https://example.com/a'),
    ).toBe(true)
    const parsed = sitemapCandidates(
      '<urlset><url><loc>https://example.com/a?utm_source=x#x</loc></url><url><loc>https://other.test/x</loc></url></urlset>',
      'https://example.com/sitemap.xml',
      'example.com',
    )
    expect(parsed.pages).toEqual(['https://example.com/a'])
  })

  it('distinguishes sitemap indexes and documents bounded limits', () => {
    const parsed = sitemapCandidates(
      '<sitemapindex><sitemap><loc>/nested.xml</loc></sitemap></sitemapindex>',
      'https://example.com/sitemap.xml',
      'example.com',
    )
    expect(parsed.indexes).toEqual(['https://example.com/nested.xml'])
    expect(MAX_SITEMAP_FILES).toBe(5)
    expect(MAX_SITEMAP_URLS).toBe(200)
  })
})
