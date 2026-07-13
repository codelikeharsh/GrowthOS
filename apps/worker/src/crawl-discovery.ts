export const MAX_CRAWL_PAGES = 10
export const MAX_CRAWL_DEPTH = 2
export const MAX_CRAWL_CONCURRENCY = 2
export const MAX_CRAWL_CANDIDATES = 50

export interface CrawlCandidate {
  url: string
  depth: number
}

const trackingParameters = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
])

const destructivePath =
  /(?:^|\/)(?:logout|log-out|signout|sign-out|delete|remove|destroy|admin|checkout|payment|cart|account-removal)(?:\/|$)/i

export function discoverInternalLinks(
  html: string,
  baseUrl: string,
  approvedHostname: string,
): string[] {
  const links = new Set<string>()
  for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>/gi)) {
    const candidate = normalizeCrawlUrl(match[2] ?? '', baseUrl, approvedHostname)
    if (candidate) links.add(candidate)
    if (links.size >= MAX_CRAWL_CANDIDATES) break
  }
  return [...links]
}

export function normalizeCrawlUrl(
  href: string,
  baseUrl: string,
  approvedHostname: string,
): string | undefined {
  let url: URL
  try {
    url = new URL(href.trim(), baseUrl)
  } catch {
    return undefined
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
  if (url.username || url.password) return undefined
  if (
    (url.protocol === 'http:' && url.port && url.port !== '80') ||
    (url.protocol === 'https:' && url.port && url.port !== '443')
  )
    return undefined
  if (url.hostname.replace(/\.$/, '').toLowerCase() !== approvedHostname.toLowerCase())
    return undefined
  if (destructivePath.test(url.pathname)) return undefined
  if (url.searchParams.size > 8) return undefined
  for (const key of trackingParameters) url.searchParams.delete(key)
  url.hash = ''
  return url.toString()
}

export function enqueueDiscoveredLinks(
  queue: CrawlCandidate[],
  seen: Set<string>,
  urls: string[],
  depth: number,
): void {
  if (depth > MAX_CRAWL_DEPTH) return
  for (const url of urls) {
    if (seen.size >= MAX_CRAWL_CANDIDATES) return
    if (seen.has(url)) continue
    seen.add(url)
    queue.push({ url, depth })
  }
}
