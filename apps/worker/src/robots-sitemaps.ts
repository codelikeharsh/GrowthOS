import { normalizeCrawlUrl } from './crawl-discovery.js'

export const GROWTHOS_AUDIT_USER_AGENT = 'GrowthOSAuditBot'
export const MAX_SITEMAP_FILES = 5
export const MAX_SITEMAP_DEPTH = 2
export const MAX_SITEMAP_URLS = 200

interface RobotsRule {
  allow: boolean
  path: string
}
export interface RobotsPolicy {
  allows(url: string): boolean
  sitemaps: string[]
}

export function parseRobots(text: string, origin: string): RobotsPolicy {
  const groups = new Map<string, RobotsRule[]>()
  const sitemaps: string[] = []
  let agents: string[] = []
  for (const source of text.split(/\r?\n/)) {
    const line = source.replace(/#.*/, '').trim()
    const separator = line.indexOf(':')
    if (separator < 0) continue
    const key = line.slice(0, separator).trim().toLowerCase()
    const value = line.slice(separator + 1).trim()
    if (key === 'user-agent') {
      agents = [value.toLowerCase()]
      continue
    }
    if (key === 'sitemap') {
      try {
        sitemaps.push(new URL(value, origin).toString())
      } catch {}
      continue
    }
    if ((key === 'allow' || key === 'disallow') && agents.length) {
      for (const agent of agents)
        groups.set(agent, [...(groups.get(agent) ?? []), { allow: key === 'allow', path: value }])
    }
  }
  const rules = [
    ...(groups.get('*') ?? []),
    ...(groups.get(GROWTHOS_AUDIT_USER_AGENT.toLowerCase()) ?? []),
  ]
  return {
    sitemaps,
    allows(url) {
      const path = new URL(url).pathname
      const match = rules
        .filter((rule) => rule.path && path.startsWith(rule.path))
        .sort((a, b) => b.path.length - a.path.length)[0]
      return !match || match.allow
    },
  }
}

export function sitemapCandidates(
  xml: string,
  baseUrl: string,
  approvedHost: string,
): { pages: string[]; indexes: string[] } {
  const pages: string[] = []
  const indexes: string[] = []
  const index = /<sitemapindex\b/i.test(xml)
  for (const match of xml.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)) {
    const url = normalizeCrawlUrl(match[1]?.trim() ?? '', baseUrl, approvedHost)
    if (!url) continue
    ;(index ? indexes : pages).push(url)
    if ((index ? indexes : pages).length >= MAX_SITEMAP_URLS) break
  }
  return { pages, indexes }
}
