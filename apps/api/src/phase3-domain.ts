import {
  AgencyClientNoteVisibility,
  AgencyClientRelationshipStatus,
  BusinessPriceType,
  BusinessSocialPlatform,
} from '@growthos/db'

const transitions: Record<AgencyClientRelationshipStatus, AgencyClientRelationshipStatus[]> = {
  PENDING: [AgencyClientRelationshipStatus.ACTIVE, AgencyClientRelationshipStatus.TERMINATED],
  ACTIVE: [AgencyClientRelationshipStatus.SUSPENDED, AgencyClientRelationshipStatus.TERMINATED],
  SUSPENDED: [AgencyClientRelationshipStatus.ACTIVE, AgencyClientRelationshipStatus.TERMINATED],
  TERMINATED: [],
}

export function canTransitionRelationship(
  from: AgencyClientRelationshipStatus,
  to: AgencyClientRelationshipStatus,
): boolean {
  return transitions[from].includes(to)
}

export function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

export function isValidCurrency(value: string): boolean {
  if (!/^[A-Z]{3}$/.test(value)) return false
  try {
    new Intl.NumberFormat('en', { style: 'currency', currency: value }).format(0)
    return true
  } catch {
    return false
  }
}

export function validatePrice(
  priceType: BusinessPriceType,
  minimum: number | undefined,
  maximum: number | undefined,
): boolean {
  if (minimum !== undefined && minimum < 0) return false
  if (maximum !== undefined && maximum < 0) return false
  if (priceType === BusinessPriceType.RANGE)
    return minimum !== undefined && maximum !== undefined && maximum >= minimum
  if (priceType === BusinessPriceType.FIXED || priceType === BusinessPriceType.STARTING_FROM)
    return minimum !== undefined
  return true
}

export interface HourInterval {
  dayOfWeek: string
  opensAtMinutes?: number
  closesAtMinutes?: number
  isClosed: boolean
}

export function hasHourOverlap(hours: HourInterval[]): boolean {
  const open = hours.filter((item) => !item.isClosed)
  return open.some((item, index) =>
    open
      .slice(index + 1)
      .some(
        (other) =>
          other.dayOfWeek === item.dayOfWeek &&
          (item.opensAtMinutes ?? 0) < (other.closesAtMinutes ?? 0) &&
          (other.opensAtMinutes ?? 0) < (item.closesAtMinutes ?? 0),
      ),
  )
}

export function normalizeSocialUrl(platform: BusinessSocialPlatform, input: string): string {
  const url = new URL(input.trim())
  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error('Only HTTP and HTTPS are allowed')
  if (platform === BusinessSocialPlatform.WHATSAPP && url.hostname === 'api.whatsapp.com') {
    const phone = url.searchParams.get('phone')?.replace(/\D/g, '')
    if (phone) return `https://wa.me/${phone}`
  }
  return url.toString()
}

export function normalizeWebsiteUrl(input: string): string {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    throw new Error('Website URL must be a valid absolute URL')
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname)
    throw new Error('Website URL must use HTTP or HTTPS')
  if (url.username || url.password) throw new Error('Website URL must not include credentials')
  url.protocol = url.protocol.toLowerCase()
  url.hostname = url.hostname.toLowerCase()
  url.hash = ''
  if (
    (url.protocol === 'http:' && url.port === '80') ||
    (url.protocol === 'https:' && url.port === '443')
  )
    url.port = ''
  return url.toString()
}

export function noteVisibilitiesForBusiness(): AgencyClientNoteVisibility[] {
  return [AgencyClientNoteVisibility.CLIENT_VISIBLE]
}
