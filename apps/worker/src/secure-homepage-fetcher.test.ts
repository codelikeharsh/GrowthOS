import { describe, expect, it } from 'vitest'
import { HomepageFetchError, SafeTargetValidator } from './secure-homepage-fetcher.js'
import { extractPageMetadata } from './audit-orchestration.js'

describe('secure homepage target validation', () => {
  it('pins a public DNS answer while retaining the original Host and SNI name', async () => {
    const validator = new SafeTargetValidator({ resolve: () => Promise.resolve(['93.184.216.34']) })
    const target = await validator.validate('https://example.com/path')
    expect(target.connections[0]).toMatchObject({
      address: '93.184.216.34',
      hostHeader: 'example.com',
      serverName: 'example.com',
    })
  })

  it.each(['http://127.0.0.1/', 'http://169.254.169.254/', 'http://[::1]/'])(
    'rejects unsafe direct address %s',
    async (url) => {
      await expect(new SafeTargetValidator().validate(url)).rejects.toMatchObject({
        code: 'WEBSITE_TARGET_IP_FORBIDDEN',
      })
    },
  )

  it('rejects mixed DNS answers and unsupported endpoint syntax', async () => {
    const validator = new SafeTargetValidator({
      resolve: () => Promise.resolve(['93.184.216.34', '10.0.0.1']),
    })
    await expect(validator.validate('https://example.com')).rejects.toMatchObject({
      code: 'WEBSITE_TARGET_IP_FORBIDDEN',
    })
    await expect(validator.validate('ftp://example.com')).rejects.toMatchObject({
      code: 'WEBSITE_TARGET_SCHEME_UNSUPPORTED',
    })
    await expect(validator.validate('https://user:pass@example.com')).rejects.toMatchObject({
      code: 'WEBSITE_TARGET_CREDENTIALS_FORBIDDEN',
    })
    await expect(validator.validate('https://example.com:444')).rejects.toMatchObject({
      code: 'WEBSITE_TARGET_PORT_FORBIDDEN',
    })
  })

  it('extracts deterministic metadata without retaining page content', () => {
    expect(
      extractPageMetadata(
        '<title>Home</title><meta name="description" content="Summary"><p>Hello world</p>',
      ),
    ).toEqual({ title: 'Home', metaDescription: 'Summary', wordCount: 3 })
  })

  it('exposes stable failure codes', () => {
    expect(new HomepageFetchError('AUDIT_PAGE_TIMEOUT', 'safe').code).toBe('AUDIT_PAGE_TIMEOUT')
  })
})
