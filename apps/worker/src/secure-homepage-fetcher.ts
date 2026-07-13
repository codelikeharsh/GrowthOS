import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { promises as dns } from 'node:dns'
import { isIP } from 'node:net'

export const MAX_HOMEPAGE_REDIRECTS = 5
export const HOMEPAGE_CONNECT_TIMEOUT_MS = 10_000
export const HOMEPAGE_TOTAL_TIMEOUT_MS = 20_000
export const HOMEPAGE_MAX_BODY_BYTES = 2 * 1024 * 1024

export interface SafeConnection {
  address: string
  family: 4 | 6
  port: number
  serverName?: string
  hostHeader: string
}

export interface SafeTarget {
  url: URL
  hostname: string
  connections: SafeConnection[]
}

export interface DnsResolver {
  resolve(hostname: string): Promise<string[]>
}

export class HomepageFetchError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export class NodeSafeDnsResolver implements DnsResolver {
  async resolve(hostname: string): Promise<string[]> {
    const answers = await Promise.allSettled([dns.resolve4(hostname), dns.resolve6(hostname)])
    const values = answers.flatMap((answer) => (answer.status === 'fulfilled' ? answer.value : []))
    if (!values.length)
      throw new HomepageFetchError('WEBSITE_TARGET_DNS_FAILED', 'DNS resolution failed')
    return values
  }
}

export class SafeTargetValidator {
  constructor(private readonly resolver: DnsResolver = new NodeSafeDnsResolver()) {}

  async validate(input: string): Promise<SafeTarget> {
    let url: URL
    try {
      url = new URL(input)
    } catch {
      throw new HomepageFetchError('WEBSITE_TARGET_INVALID', 'Website target URL is invalid')
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      throw new HomepageFetchError(
        'WEBSITE_TARGET_SCHEME_UNSUPPORTED',
        'Website target scheme is unsupported',
      )
    if (url.username || url.password)
      throw new HomepageFetchError(
        'WEBSITE_TARGET_CREDENTIALS_FORBIDDEN',
        'Website target credentials are forbidden',
      )
    const hostname = url.hostname
      .replace(/^\[|\]$/g, '')
      .replace(/\.$/, '')
      .toLowerCase()
    const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80
    if ((url.protocol === 'https:' && port !== 443) || (url.protocol === 'http:' && port !== 80))
      throw new HomepageFetchError(
        'WEBSITE_TARGET_PORT_FORBIDDEN',
        'Website target port is forbidden',
      )
    if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost'))
      throw new HomepageFetchError(
        'WEBSITE_TARGET_HOST_FORBIDDEN',
        'Website target hostname is forbidden',
      )
    const direct = isIP(hostname)
    const addresses = direct ? [hostname] : await this.resolver.resolve(hostname)
    if (!addresses.length)
      throw new HomepageFetchError(
        'WEBSITE_TARGET_DNS_EMPTY',
        'Website target DNS returned no addresses',
      )
    const connections = addresses.map((address) => {
      const family = isIP(address)
      if (!family || !isSafeIp(address))
        throw new HomepageFetchError(
          'WEBSITE_TARGET_IP_FORBIDDEN',
          'Website target resolved to a forbidden IP address',
        )
      return {
        address,
        family: family as 4 | 6,
        port,
        ...(url.protocol === 'https:' ? { serverName: hostname } : {}),
        hostHeader: url.host,
      }
    })
    return { url, hostname, connections }
  }
}

export interface HomepageResponse {
  finalUrl: string
  httpStatus: number
  contentType: string
  body: Buffer
  durationMs: number
  connection: SafeConnection
}

export interface SecurePageFetcher {
  fetch(url: string, signal?: AbortSignal): Promise<HomepageResponse>
}

export class SecureHomepageFetcher implements SecurePageFetcher {
  constructor(private readonly validator: SafeTargetValidator) {}

  async fetch(url: string, signal?: AbortSignal): Promise<HomepageResponse> {
    let target = await this.validator.validate(url)
    const visited = new Set([target.url.toString()])
    const started = Date.now()
    for (let redirects = 0; ; redirects += 1) {
      const response = await this.request(target, signal, started)
      const location = response.headers.location
      if (response.statusCode >= 300 && response.statusCode < 400 && location) {
        if (redirects >= MAX_HOMEPAGE_REDIRECTS)
          throw new HomepageFetchError('WEBSITE_TARGET_REDIRECT_LIMIT', 'Redirect limit exceeded')
        const nextUrl = new URL(location, target.url)
        if (target.url.protocol === 'https:' && nextUrl.protocol === 'http:')
          throw new HomepageFetchError(
            'WEBSITE_TARGET_REDIRECT_FORBIDDEN',
            'HTTPS downgrade is forbidden',
          )
        target = await this.validator.validate(nextUrl.toString())
        if (visited.has(target.url.toString()))
          throw new HomepageFetchError('WEBSITE_TARGET_REDIRECT_LOOP', 'Redirect loop detected')
        visited.add(target.url.toString())
        continue
      }
      const contentType = (
        String(response.headers['content-type'] ?? '').split(';')[0] ?? ''
      ).toLowerCase()
      if (contentType !== 'text/html' && contentType !== 'application/xhtml+xml')
        throw new HomepageFetchError(
          'AUDIT_PAGE_CONTENT_TYPE_UNSUPPORTED',
          'Homepage response is not HTML',
        )
      return {
        finalUrl: target.url.toString(),
        httpStatus: response.statusCode,
        contentType,
        body: response.body,
        durationMs: Date.now() - started,
        connection: this.firstConnection(target),
      }
    }
  }

  private request(
    target: SafeTarget,
    signal: AbortSignal | undefined,
    started: number,
  ): Promise<{
    statusCode: number
    headers: Record<string, string | string[] | undefined>
    body: Buffer
  }> {
    const connection = this.firstConnection(target)
    return new Promise((resolve, reject) => {
      const timedOut = (): void => {
        reject(new HomepageFetchError('AUDIT_PAGE_TIMEOUT', 'Homepage request timed out'))
      }
      const client = target.url.protocol === 'https:' ? httpsRequest : httpRequest
      const request = client(
        {
          protocol: target.url.protocol,
          hostname: connection.address,
          family: connection.family,
          port: connection.port,
          path: `${target.url.pathname}${target.url.search}`,
          method: 'GET',
          agent: false,
          servername: connection.serverName,
          headers: {
            Host: connection.hostHeader,
            'User-Agent': 'GrowthOS-Audit/4D1 (+https://growthos.local/audit)',
            Accept: 'text/html,application/xhtml+xml',
            Connection: 'close',
          },
          timeout: HOMEPAGE_CONNECT_TIMEOUT_MS,
          signal,
        },
        (response) => {
          const chunks: Buffer[] = []
          let size = 0
          response.on('data', (chunk: Buffer) => {
            size += chunk.length
            if (size > HOMEPAGE_MAX_BODY_BYTES) {
              request.destroy(
                new HomepageFetchError(
                  'AUDIT_PAGE_BODY_TOO_LARGE',
                  'Homepage response is too large',
                ),
              )
              return
            }
            chunks.push(chunk)
          })
          response.once('end', () => {
            resolve({
              statusCode: response.statusCode ?? 0,
              headers: response.headers,
              body: Buffer.concat(chunks),
            })
          })
        },
      )
      const totalTimer = setTimeout(
        () => {
          request.destroy(
            new HomepageFetchError('AUDIT_PAGE_TIMEOUT', 'Homepage request timed out'),
          )
        },
        Math.max(1, HOMEPAGE_TOTAL_TIMEOUT_MS - (Date.now() - started)),
      )
      request.once('timeout', timedOut)
      request.once('error', (error) => {
        reject(
          error instanceof HomepageFetchError
            ? error
            : new HomepageFetchError('AUDIT_PAGE_FETCH_FAILED', 'Homepage request failed'),
        )
      })
      request.once('close', () => {
        clearTimeout(totalTimer)
      })
      request.end()
    })
  }

  private firstConnection(target: SafeTarget): SafeConnection {
    const connection = target.connections[0]
    if (!connection) throw new HomepageFetchError('WEBSITE_TARGET_DNS_EMPTY', 'No safe address')
    return connection
  }
}

function isSafeIp(address: string): boolean {
  const family = isIP(address)
  if (family === 4) {
    const parts = address.split('.').map(Number)
    const a = parts[0] ?? 0
    const b = parts[1] ?? 0
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 168)) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51) ||
      (a === 203 && b === 0)
    )
  }
  const normalized = address.toLowerCase()
  return !(
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb') ||
    normalized.startsWith('ff') ||
    normalized.startsWith('::ffff:')
  )
}
