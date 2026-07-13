import { describe, expect, it } from 'vitest'
import {
  discoverInternalLinks,
  enqueueDiscoveredLinks,
  MAX_CRAWL_CANDIDATES,
  MAX_CRAWL_DEPTH,
  MAX_CRAWL_PAGES,
} from './crawl-discovery.js'

describe('bounded internal-page discovery', () => {
  it('resolves internal links, removes fragments/tracking, and suppresses duplicates', () => {
    const links = discoverInternalLinks(
      '<a href="/about?utm_source=x#team">About</a><a href="https://example.com/about">Again</a>',
      'https://example.com/',
      'example.com',
    )
    expect(links).toEqual(['https://example.com/about'])
  })

  it('rejects external, unsupported, credentialed, destructive, and custom-port links', () => {
    const links = discoverInternalLinks(
      '<a href="mailto:x@example.com">Mail</a><a href="https://elsewhere.test/">External</a><a href="/logout">Out</a><a href="https://user:pass@example.com/a">Credentials</a><a href="https://example.com:444/a">Port</a><a href="/safe">Safe</a>',
      'https://example.com/',
      'example.com',
    )
    expect(links).toEqual(['https://example.com/safe'])
  })

  it('enforces depth and retained-candidate bounds', () => {
    const queue: { url: string; depth: number }[] = []
    const seen = new Set<string>()
    enqueueDiscoveredLinks(queue, seen, ['https://example.com/a'], MAX_CRAWL_DEPTH + 1)
    expect(queue).toEqual([])
    enqueueDiscoveredLinks(
      queue,
      seen,
      Array.from(
        { length: MAX_CRAWL_CANDIDATES + 10 },
        (_, index) => `https://example.com/${String(index)}`,
      ),
      1,
    )
    expect(queue).toHaveLength(MAX_CRAWL_CANDIDATES)
  })

  it('uses the documented ten-page cap', () => {
    expect(MAX_CRAWL_PAGES).toBe(10)
  })
})
