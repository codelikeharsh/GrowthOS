import { promises as dns } from 'node:dns'
import { isIP } from 'node:net'
import { domainToASCII } from 'node:url'
import { HttpStatus, Inject, Injectable } from '@nestjs/common'
import { DomainError } from './domain-error.js'

export const WEBSITE_DNS_RESOLVER = 'WEBSITE_DNS_RESOLVER'
const DNS_TIMEOUT_MS = 3_000
const MAX_CNAME_DEPTH = 8
export const MAX_WEBSITE_REDIRECTS = 5

export interface DnsResolution {
  addresses: string[]
  aliases?: string[]
}

export interface DnsResolver {
  resolve(hostname: string): Promise<DnsResolution>
}

export interface ValidatedConnectionTarget {
  address: string
  family: 4 | 6
  port: number
  serverName?: string
  hostHeader: string
}

export interface ValidatedWebsiteTarget {
  url: URL
  hostname: string
  port: number
  connections: ValidatedConnectionTarget[]
}

export interface RedirectState {
  current: ValidatedWebsiteTarget
  redirects: number
  visited: Set<string>
}

export class DnsResolutionFailure extends Error {
  constructor(readonly kind: 'failed' | 'timeout') {
    super(kind)
  }
}

@Injectable()
export class NodeDnsResolver implements DnsResolver {
  async resolve(hostname: string): Promise<DnsResolution> {
    const [v4, v6, aliases] = await Promise.allSettled([
      this.withTimeout(dns.resolve4(hostname)),
      this.withTimeout(dns.resolve6(hostname)),
      this.cnameChain(hostname),
    ])
    const addresses = [
      ...(v4.status === 'fulfilled' ? v4.value : []),
      ...(v6.status === 'fulfilled' ? v6.value : []),
    ]
    if (!addresses.length && v4.status === 'rejected' && v6.status === 'rejected') {
      const failures = [v4.reason, v6.reason]
      if (
        failures.some(
          (failure) => failure instanceof DnsResolutionFailure && failure.kind === 'timeout',
        )
      )
        throw new DnsResolutionFailure('timeout')
      throw new DnsResolutionFailure('failed')
    }
    return {
      addresses,
      ...(aliases.status === 'fulfilled' && aliases.value.length ? { aliases: aliases.value } : {}),
    }
  }

  private async cnameChain(
    hostname: string,
    seen = new Set<string>(),
    depth = 0,
  ): Promise<string[]> {
    if (depth >= MAX_CNAME_DEPTH || seen.has(hostname)) return []
    seen.add(hostname)
    try {
      const aliases = await this.withTimeout(dns.resolveCname(hostname))
      const nested = await Promise.all(
        aliases.map((alias) => this.cnameChain(alias, seen, depth + 1)),
      )
      return [...aliases, ...nested.flat()]
    } catch {
      return []
    }
  }

  private async withTimeout<T>(operation: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        operation,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => {
            reject(new DnsResolutionFailure('timeout'))
          }, DNS_TIMEOUT_MS)
        }),
      ])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
}

export function classifyIpAddress(input: string): {
  address: string
  family: 4 | 6
  safe: boolean
} {
  const family = isIP(input)
  if (family === 4) {
    const address = input
      .split('.')
      .map((part) => String(Number(part)))
      .join('.')
    return { address, family: 4, safe: !isBlockedIpv4(address) }
  }
  if (family === 6) {
    const value = ipv6Value(input)
    const mapped = inIpv6Range(value, '::ffff:0:0', 96)
    if (mapped) {
      const mappedV4 = [24n, 16n, 8n, 0n]
        .map((shift) => String(Number((value >> shift) & 255n)))
        .join('.')
      return { address: input.toLowerCase(), family: 6, safe: !isBlockedIpv4(mappedV4) }
    }
    const blocked = [
      ['::', 96],
      ['64:ff9b::', 96],
      ['64:ff9b:1::', 48],
      ['100::', 64],
      ['100:0:0:1::', 64],
      ['2001::', 23],
      ['2002::', 16],
      ['2001:db8::', 32],
      ['3fff::', 20],
      ['5f00::', 16],
      ['fc00::', 7],
      ['fe80::', 10],
      ['ff00::', 8],
    ] as const
    return {
      address: input.toLowerCase(),
      family: 6,
      safe: !blocked.some(([network, prefix]) => inIpv6Range(value, network, prefix)),
    }
  }
  throw new Error('Invalid IP address')
}

function isBlockedIpv4(address: string): boolean {
  const value = ipv4Value(address)
  const blocked = [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.0.2.0', 24],
    ['192.31.196.0', 24],
    ['192.52.193.0', 24],
    ['192.88.99.0', 24],
    ['192.168.0.0', 16],
    ['192.175.48.0', 24],
    ['198.18.0.0', 15],
    ['198.51.100.0', 24],
    ['203.0.113.0', 24],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4],
  ] as const
  return blocked.some(([network, prefix]) => inIpv4Range(value, network, prefix))
}

function ipv4Value(address: string): number {
  return address.split('.').reduce((value, part) => (value << 8) + Number(part), 0) >>> 0
}

function inIpv4Range(value: number, network: string, prefix: number): boolean {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
  return (value & mask) === (ipv4Value(network) & mask)
}

function ipv6Value(input: string): bigint {
  let source = input.toLowerCase()
  if (source.includes('.')) {
    const split = source.lastIndexOf(':')
    const v4 = source.slice(split + 1)
    if (isIP(v4) !== 4) throw new Error('Invalid IPv6 address')
    const value = ipv4Value(v4)
    source = `${source.slice(0, split)}:${((value >>> 16) & 0xffff).toString(16)}:${(value & 0xffff).toString(16)}`
  }
  const halves = source.split('::')
  if (halves.length > 2) throw new Error('Invalid IPv6 address')
  const [leftPart = '', rightPart = ''] = halves
  const left = leftPart ? leftPart.split(':') : []
  const right = rightPart ? rightPart.split(':') : []
  const words =
    halves.length === 2
      ? [...left, ...Array.from({ length: 8 - left.length - right.length }, () => '0'), ...right]
      : left
  if (words.length !== 8 || words.some((word) => !/^[0-9a-f]{1,4}$/.test(word)))
    throw new Error('Invalid IPv6 address')
  return words.reduce((value, word) => (value << 16n) + BigInt(`0x${word}`), 0n)
}

function inIpv6Range(value: bigint, network: string, prefix: number): boolean {
  return value >> BigInt(128 - prefix) === ipv6Value(network) >> BigInt(128 - prefix)
}

@Injectable()
export class WebsiteTargetValidator {
  constructor(@Inject(WEBSITE_DNS_RESOLVER) private readonly resolver: DnsResolver) {}

  async validate(input: string): Promise<ValidatedWebsiteTarget> {
    const { url, hostname, rawHostname, port } = this.parse(input)
    const directFamily = isIP(hostname)
    if (directFamily) {
      if (directFamily === 4 && rawHostname !== hostname)
        throw this.error(
          'WEBSITE_TARGET_INVALID',
          'Website target has an ambiguous IP representation',
        )
      const classified = this.classify(hostname)
      return this.target(url, hostname, port, [classified])
    }
    this.validateHostname(hostname, rawHostname)
    let resolution: DnsResolution
    try {
      resolution = await this.resolver.resolve(hostname)
    } catch (cause) {
      throw this.error(
        cause instanceof DnsResolutionFailure && cause.kind === 'timeout'
          ? 'WEBSITE_TARGET_DNS_FAILED'
          : 'WEBSITE_TARGET_DNS_FAILED',
        'Website target DNS resolution failed',
      )
    }
    if (!Array.isArray(resolution.addresses) || resolution.addresses.length === 0)
      throw this.error('WEBSITE_TARGET_DNS_EMPTY', 'Website target DNS returned no addresses')
    for (const alias of resolution.aliases ?? []) this.validateDnsAlias(alias)
    const addresses = resolution.addresses.map((address) => this.classify(address))
    return this.target(url, hostname, port, addresses)
  }

  private parse(input: string): { url: URL; hostname: string; rawHostname: string; port: number } {
    const raw = input.trim()
    let url: URL
    try {
      url = new URL(raw)
    } catch {
      throw this.error('WEBSITE_TARGET_INVALID', 'Website target URL is invalid')
    }
    if (!['http:', 'https:'].includes(url.protocol))
      throw this.error('WEBSITE_TARGET_SCHEME_UNSUPPORTED', 'Website target must use HTTP or HTTPS')
    if (url.username || url.password)
      throw this.error(
        'WEBSITE_TARGET_CREDENTIALS_FORBIDDEN',
        'Website target credentials are forbidden',
      )
    const hostname = url.hostname
      .replace(/^\[|\]$/g, '')
      .replace(/\.$/, '')
      .toLowerCase()
    const rawHostname = rawHostnameFrom(raw)
      .replace(/^\[|\]$/g, '')
      .replace(/\.$/, '')
      .toLowerCase()
    if (!hostname || !rawHostname)
      throw this.error('WEBSITE_TARGET_INVALID', 'Website target hostname is invalid')
    const port = url.port ? Number(url.port) : url.protocol === 'http:' ? 80 : 443
    if ((url.protocol === 'http:' && port !== 80) || (url.protocol === 'https:' && port !== 443))
      throw this.error('WEBSITE_TARGET_PORT_FORBIDDEN', 'Website target port is forbidden')
    if (hostname === 'localhost' || hostname.endsWith('.localhost'))
      throw this.error('WEBSITE_TARGET_HOST_FORBIDDEN', 'Website target hostname is forbidden')
    return { url, hostname, rawHostname, port }
  }

  private validateHostname(hostname: string, rawHostname: string): void {
    const ascii = domainToASCII(rawHostname)
    if (!ascii || ascii.toLowerCase() !== hostname || hostname.length > 253)
      throw this.error('WEBSITE_TARGET_INVALID', 'Website target hostname is invalid')
    if (hostname.split('.').some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)))
      throw this.error('WEBSITE_TARGET_INVALID', 'Website target hostname is invalid')
  }

  private validateDnsAlias(alias: string): void {
    const hostname = alias.replace(/\.$/, '').toLowerCase()
    if (
      !hostname ||
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      !domainToASCII(hostname)
    )
      throw this.error('WEBSITE_TARGET_HOST_FORBIDDEN', 'Website target DNS alias is forbidden')
  }

  private classify(address: string): { address: string; family: 4 | 6 } {
    try {
      const classified = classifyIpAddress(address)
      if (!classified.safe)
        throw this.error(
          'WEBSITE_TARGET_IP_FORBIDDEN',
          'Website target resolved to a forbidden IP address',
        )
      return { address: classified.address, family: classified.family }
    } catch (cause) {
      if (cause instanceof DomainError) throw cause
      throw this.error(
        'WEBSITE_TARGET_DNS_FAILED',
        'Website target DNS returned an invalid address',
      )
    }
  }

  private target(
    url: URL,
    hostname: string,
    port: number,
    addresses: { address: string; family: 4 | 6 }[],
  ): ValidatedWebsiteTarget {
    return {
      url,
      hostname,
      port,
      connections: addresses.map(({ address, family }) => ({
        address,
        family,
        port,
        ...(url.protocol === 'https:' ? { serverName: hostname } : {}),
        hostHeader: url.host,
      })),
    }
  }

  private error(code: string, message: string): DomainError {
    return new DomainError(code, message, HttpStatus.BAD_REQUEST)
  }
}

@Injectable()
export class OutboundRequestPolicy {
  constructor(@Inject(WebsiteTargetValidator) private readonly validator: WebsiteTargetValidator) {}

  async begin(url: string): Promise<RedirectState> {
    const current = await this.validator.validate(url)
    return { current, redirects: 0, visited: new Set([current.url.toString()]) }
  }

  async redirect(state: RedirectState, location: string): Promise<RedirectState> {
    if (state.redirects >= MAX_WEBSITE_REDIRECTS)
      throw this.error('WEBSITE_TARGET_REDIRECT_LIMIT', 'Website target redirect limit exceeded')
    let candidate: URL
    try {
      candidate = new URL(location, state.current.url)
    } catch {
      throw this.error('WEBSITE_TARGET_REDIRECT_FORBIDDEN', 'Website target redirect is forbidden')
    }
    if (state.current.url.protocol === 'https:' && candidate.protocol === 'http:')
      throw this.error(
        'WEBSITE_TARGET_REDIRECT_FORBIDDEN',
        'Website target protocol downgrade is forbidden',
      )
    let next: ValidatedWebsiteTarget
    try {
      next = await this.validator.validate(candidate.toString())
    } catch {
      throw this.error('WEBSITE_TARGET_REDIRECT_FORBIDDEN', 'Website target redirect is forbidden')
    }
    const key = next.url.toString()
    if (state.visited.has(key))
      throw this.error('WEBSITE_TARGET_REDIRECT_LOOP', 'Website target redirect loop detected')
    return {
      current: next,
      redirects: state.redirects + 1,
      visited: new Set([...state.visited, key]),
    }
  }

  private error(code: string, message: string): DomainError {
    return new DomainError(code, message, HttpStatus.BAD_REQUEST)
  }
}

function rawHostnameFrom(input: string): string {
  const match = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/i.exec(input)
  if (!match) return ''
  const authority = (match[1] ?? '').slice((match[1] ?? '').lastIndexOf('@') + 1)
  if (authority.startsWith('[')) return authority.slice(0, authority.indexOf(']') + 1)
  return authority.split(':')[0] ?? ''
}
