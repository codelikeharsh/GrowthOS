import { describe, expect, it } from 'vitest'
import {
  OutboundRequestPolicy,
  DnsResolutionFailure,
  type DnsResolver,
  WebsiteTargetValidator,
} from './website-target-security.js'

class FakeResolver implements DnsResolver {
  seen: string[] = []
  constructor(private readonly records: Record<string, string[] | Error>) {}
  resolve(hostname: string): Promise<{ addresses: string[] }> {
    this.seen.push(hostname)
    const record = this.records[hostname]
    if (record instanceof Error) return Promise.reject(record)
    return Promise.resolve({ addresses: record ?? [] })
  }
}

function code(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('getResponse' in error)) return undefined
  const response = (error as { getResponse(): unknown }).getResponse()
  return typeof response === 'object' && response !== null && 'code' in response
    ? String(response.code)
    : undefined
}

function validator(records: Record<string, string[] | Error> = {}) {
  return new WebsiteTargetValidator(new FakeResolver(records))
}

describe('website outbound target security', () => {
  it('accepts public IPv4 and IPv6 only on standard ports', async () => {
    await expect(validator().validate('http://8.8.8.8:80/path')).resolves.toMatchObject({
      port: 80,
    })
    await expect(
      validator().validate('https://[2606:4700:4700::1111]:443/'),
    ).resolves.toMatchObject({ port: 443 })
  })

  it('rejects loopback, unspecified, private, link-local, metadata, multicast, and special addresses', async () => {
    for (const host of [
      '127.0.0.1',
      '0.0.0.0',
      '10.0.0.1',
      '172.16.0.1',
      '192.168.1.1',
      '169.254.1.1',
      '169.254.169.254',
      '224.0.0.1',
      '[::1]',
      '[fc00::1]',
      '[fe80::1]',
      '[::ffff:192.168.1.1]',
      '[2001:db8::1]',
    ]) {
      await expect(validator().validate(`https://${host}/`)).rejects.toSatisfy(
        (error: unknown) => code(error) === 'WEBSITE_TARGET_IP_FORBIDDEN',
      )
    }
    await expect(validator().validate('https://localhost/')).rejects.toSatisfy(
      (error: unknown) => code(error) === 'WEBSITE_TARGET_HOST_FORBIDDEN',
    )
  })

  it('rejects mixed, empty, failed, and malformed DNS answers without accepting a public subset', async () => {
    await expect(
      validator({ mixed: ['8.8.8.8', '10.0.0.1'] }).validate('https://mixed/'),
    ).rejects.toSatisfy((error: unknown) => code(error) === 'WEBSITE_TARGET_IP_FORBIDDEN')
    await expect(validator({ empty: [] }).validate('https://empty/')).rejects.toSatisfy(
      (error: unknown) => code(error) === 'WEBSITE_TARGET_DNS_EMPTY',
    )
    await expect(
      validator({ failed: new Error('resolver unavailable') }).validate('https://failed/'),
    ).rejects.toSatisfy((error: unknown) => code(error) === 'WEBSITE_TARGET_DNS_FAILED')
    await expect(
      validator({ timeout: new DnsResolutionFailure('timeout') }).validate('https://timeout/'),
    ).rejects.toSatisfy((error: unknown) => code(error) === 'WEBSITE_TARGET_DNS_FAILED')
    await expect(
      validator({ malformed: ['not-an-ip'] }).validate('https://malformed/'),
    ).rejects.toSatisfy((error: unknown) => code(error) === 'WEBSITE_TARGET_DNS_FAILED')
  })

  it('rejects forbidden names exposed in DNS CNAME chains', async () => {
    const resolver: DnsResolver = {
      resolve: () => Promise.resolve({ addresses: ['8.8.8.8'], aliases: ['localhost'] }),
    }
    await expect(
      new WebsiteTargetValidator(resolver).validate('https://safe.example/'),
    ).rejects.toSatisfy((error: unknown) => code(error) === 'WEBSITE_TARGET_HOST_FORBIDDEN')
  })

  it('rejects credentials, non-HTTP schemes, forbidden ports, and unusual IP notation', async () => {
    for (const input of [
      'https://user:secret@example.com/',
      'file:///etc/passwd',
      'data:text/plain,hello',
      'ftp://example.com/',
      'https://example.com:8443/',
      'http://2130706433/',
      'http://0x7f000001/',
      'http://0177.0.0.1/',
    ]) {
      await expect(validator().validate(input)).rejects.toBeDefined()
    }
  })

  it('handles an internationalized hostname through ASCII DNS resolution', async () => {
    const resolver = new FakeResolver({ 'xn--bcher-kva.example': ['8.8.8.8'] })
    const target = await new WebsiteTargetValidator(resolver).validate('https://bücher.example/')
    expect(target.hostname).toBe('xn--bcher-kva.example')
    expect(resolver.seen).toEqual(['xn--bcher-kva.example'])
  })

  it('validates every redirect destination, blocks downgrade and loops, and limits redirects', async () => {
    const policy = new OutboundRequestPolicy(
      validator({ safe: ['8.8.8.8'], other: ['1.1.1.1'], private: ['127.0.0.1'] }),
    )
    const initial = await policy.begin('https://safe/start')
    await expect(policy.redirect(initial, 'https://private/')).rejects.toSatisfy(
      (error: unknown) => code(error) === 'WEBSITE_TARGET_REDIRECT_FORBIDDEN',
    )
    await expect(policy.redirect(initial, 'http://other/')).rejects.toSatisfy(
      (error: unknown) => code(error) === 'WEBSITE_TARGET_REDIRECT_FORBIDDEN',
    )
    await expect(policy.redirect(initial, '/start')).rejects.toSatisfy(
      (error: unknown) => code(error) === 'WEBSITE_TARGET_REDIRECT_LOOP',
    )
    let state = initial
    for (let index = 0; index < 5; index += 1)
      state = await policy.redirect(state, `/next-${String(index)}`)
    await expect(policy.redirect(state, '/too-many')).rejects.toSatisfy(
      (error: unknown) => code(error) === 'WEBSITE_TARGET_REDIRECT_LIMIT',
    )
  })
})
