import { describe, expect, it } from 'vitest'
import {
  AgencyClientRelationshipStatus as RelationshipStatus,
  BusinessPriceType,
  BusinessSocialPlatform,
} from '@growthos/db'
import {
  canTransitionRelationship,
  hasHourOverlap,
  isValidCurrency,
  isValidTimezone,
  normalizeSocialUrl,
  noteVisibilitiesForBusiness,
  validatePrice,
} from './phase3-domain.js'

describe('Phase 3 domain rules', () => {
  it('allows only the approved relationship transitions', () => {
    expect(canTransitionRelationship(RelationshipStatus.PENDING, RelationshipStatus.ACTIVE)).toBe(
      true,
    )
    expect(canTransitionRelationship(RelationshipStatus.ACTIVE, RelationshipStatus.SUSPENDED)).toBe(
      true,
    )
    expect(canTransitionRelationship(RelationshipStatus.SUSPENDED, RelationshipStatus.ACTIVE)).toBe(
      true,
    )
    expect(
      canTransitionRelationship(RelationshipStatus.TERMINATED, RelationshipStatus.ACTIVE),
    ).toBe(false)
    expect(
      canTransitionRelationship(RelationshipStatus.PENDING, RelationshipStatus.SUSPENDED),
    ).toBe(false)
  })

  it('validates IANA timezones and ISO-style currency codes', () => {
    expect(isValidTimezone('Asia/Kolkata')).toBe(true)
    expect(isValidTimezone('Mars/Olympus')).toBe(false)
    expect(isValidCurrency('USD')).toBe(true)
    expect(isValidCurrency('NOPE')).toBe(false)
  })

  it('validates explicit minor-unit pricing', () => {
    expect(validatePrice(BusinessPriceType.QUOTE_REQUIRED, undefined, undefined)).toBe(true)
    expect(validatePrice(BusinessPriceType.RANGE, 10_000, 20_000)).toBe(true)
    expect(validatePrice(BusinessPriceType.RANGE, 20_000, 10_000)).toBe(false)
    expect(validatePrice(BusinessPriceType.FIXED, undefined, undefined)).toBe(false)
  })

  it('detects same-day opening-hour overlap', () => {
    expect(
      hasHourOverlap([
        { dayOfWeek: 'MONDAY', opensAtMinutes: 540, closesAtMinutes: 720, isClosed: false },
        { dayOfWeek: 'MONDAY', opensAtMinutes: 660, closesAtMinutes: 780, isClosed: false },
      ]),
    ).toBe(true)
    expect(
      hasHourOverlap([
        { dayOfWeek: 'MONDAY', opensAtMinutes: 540, closesAtMinutes: 720, isClosed: false },
        { dayOfWeek: 'MONDAY', opensAtMinutes: 720, closesAtMinutes: 780, isClosed: false },
      ]),
    ).toBe(false)
  })

  it('normalizes WhatsApp links without relaxing the protocol allowlist', () => {
    expect(
      normalizeSocialUrl(
        BusinessSocialPlatform.WHATSAPP,
        'https://api.whatsapp.com/send?phone=+1 (555) 123-4567',
      ),
    ).toBe('https://wa.me/15551234567')
    expect(() => normalizeSocialUrl(BusinessSocialPlatform.OTHER, 'javascript:alert(1)')).toThrow()
  })

  it('limits business note visibility at the serializer boundary', () => {
    expect(noteVisibilitiesForBusiness()).toEqual(['CLIENT_VISIBLE'])
  })
})
