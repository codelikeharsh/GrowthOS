import { AuditPageStatus } from '@growthos/db'
import { describe, expect, it } from 'vitest'
import { evaluateFindings } from './finding-rules.js'

describe('deterministic finding rules', () => {
  it('creates stable findings for failed, missing metadata, and thin pages', () => {
    const findings = evaluateFindings([
      {
        id: 'page',
        normalizedUrl: 'https://example.com/',
        status: AuditPageStatus.FETCHED,
        wordCount: 10,
      },
    ])
    expect(findings.map((item) => item.ruleId)).toEqual(
      expect.arrayContaining([
        'SEO_TITLE_MISSING',
        'SEO_META_DESCRIPTION_MISSING',
        'SEO_CANONICAL_MISSING',
        'CONTENT_THIN',
      ]),
    )
    expect(
      evaluateFindings([
        {
          id: 'page',
          normalizedUrl: 'https://example.com/',
          status: AuditPageStatus.FETCHED,
          wordCount: 10,
        },
      ])[0]?.fingerprint,
    ).toBe(findings[0]?.fingerprint)
  })

  it('detects duplicate titles and failed page attempts', () => {
    const findings = evaluateFindings([
      {
        id: 'a',
        normalizedUrl: 'https://example.com/a',
        status: AuditPageStatus.FETCHED,
        title: 'Duplicate title',
        metaDescription: 'Description',
        canonicalUrl: 'https://example.com/a',
        wordCount: 200,
      },
      {
        id: 'b',
        normalizedUrl: 'https://example.com/b',
        status: AuditPageStatus.FAILED,
        errorCode: 'AUDIT_PAGE_TIMEOUT',
      },
      {
        id: 'c',
        normalizedUrl: 'https://example.com/c',
        status: AuditPageStatus.FETCHED,
        title: 'Duplicate title',
        metaDescription: 'Description',
        canonicalUrl: 'https://example.com/c',
        wordCount: 200,
      },
    ])
    expect(findings.map((item) => item.ruleId)).toEqual(
      expect.arrayContaining([
        'TECHNICAL_PAGE_FETCH_FAILED',
        'SEO_TITLE_DUPLICATE',
        'SEO_META_DESCRIPTION_DUPLICATE',
      ]),
    )
  })
})
