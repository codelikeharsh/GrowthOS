'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { apiRequest } from '../lib/api'
import {
  agencyBusinessHeaders,
  businessHeaders,
  useActiveOrganization,
} from '../lib/use-active-organization'

type Kind = 'locations' | 'services' | 'hours' | 'social-links'
interface Props {
  kind: Kind
  agencyId?: string
  relationshipId?: string
}
const resourceSchema = z.object({
  name: z.string().optional(),
  countryCode: z.string().optional(),
  locationType: z.enum(['HEADQUARTERS', 'OFFICE', 'STORE', 'SERVICE_AREA', 'OTHER']).optional(),
  isPrimary: z.boolean().optional(),
  priceType: z
    .enum(['FIXED', 'STARTING_FROM', 'RANGE', 'QUOTE_REQUIRED', 'FREE', 'NOT_DISPLAYED'])
    .optional(),
  startingPriceMinor: z.string().optional(),
  currency: z.string().optional(),
  platform: z
    .enum([
      'INSTAGRAM',
      'FACEBOOK',
      'LINKEDIN',
      'YOUTUBE',
      'X',
      'WHATSAPP',
      'GOOGLE_BUSINESS_PROFILE',
      'OTHER',
    ])
    .optional(),
  url: z.string().optional(),
  hours: z.string().optional(),
})
type ResourceValues = z.infer<typeof resourceSchema>

export function BusinessResourceManager({ kind, agencyId, relationshipId }: Props) {
  const {
    organization,
    loading: contextLoading,
    error: contextError,
  } = useActiveOrganization('BUSINESS')
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  const [message, setMessage] = useState('')
  const headers = useMemo(
    () =>
      agencyId && relationshipId
        ? agencyBusinessHeaders(agencyId, relationshipId)
        : organization
          ? businessHeaders(organization.id)
          : undefined,
    [agencyId, relationshipId, organization],
  )
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResourceValues>({
    resolver: zodResolver(resourceSchema),
    defaultValues: {
      name: '',
      countryCode: 'IN',
      locationType: 'OFFICE',
      isPrimary: false,
      priceType: 'QUOTE_REQUIRED',
      startingPriceMinor: '',
      currency: 'INR',
      platform: 'INSTAGRAM',
      url: '',
      hours:
        '[{"dayOfWeek":"MONDAY","opensAtMinutes":540,"closesAtMinutes":1020,"isClosed":false,"displayOrder":0}]',
    },
  })
  async function load(): Promise<void> {
    if (!headers || kind === 'hours') return
    try {
      setItems(
        await apiRequest<Array<Record<string, unknown>>>(`/business-profile/${kind}`, { headers }),
      )
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Unable to load')
    }
  }
  useEffect(() => {
    if (!headers || kind === 'hours') return
    const controller = new AbortController()
    apiRequest<Array<Record<string, unknown>>>(`/business-profile/${kind}`, {
      headers,
      signal: controller.signal,
    })
      .then(setItems)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setMessage(cause instanceof Error ? cause.message : 'Unable to load')
      })
    return () => controller.abort()
  }, [headers, kind])
  async function submit(values: ResourceValues): Promise<void> {
    if (!headers) return
    try {
      let body: object
      if (kind === 'hours') body = { hours: JSON.parse(values.hours ?? '[]') }
      else if (kind === 'services')
        body = {
          name: values.name,
          priceType: values.priceType,
          ...(values.startingPriceMinor
            ? { startingPriceMinor: Number(values.startingPriceMinor) }
            : {}),
          currency: values.currency,
        }
      else if (kind === 'locations')
        body = {
          name: values.name,
          countryCode: values.countryCode,
          locationType: values.locationType,
          isPrimary: values.isPrimary,
        }
      else body = { platform: values.platform, url: values.url }
      await apiRequest(`/business-profile/${kind}`, {
        method: kind === 'hours' ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify(body),
      })
      setMessage('Saved.')
      await load()
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Unable to save')
    }
  }
  if (!agencyId && contextLoading) return <p>Loading business workspace…</p>
  if (!agencyId && !organization)
    return <p role="alert">{contextError || 'A business organization is required.'}</p>
  const title = kind === 'social-links' ? 'Social links' : kind[0]?.toUpperCase() + kind.slice(1)
  return (
    <section className="space-y-5">
      <form
        className="space-y-4 rounded-xl border border-[var(--line)] bg-white p-6"
        onSubmit={handleSubmit(submit)}
      >
        <h2 className="text-xl font-semibold">Add {title.slice(0, -1)}</h2>
        {kind === 'locations' ? (
          <>
            <Label label="Name">
              <input {...register('name')} />
            </Label>
            <Label label="Country">
              <input {...register('countryCode')} />
            </Label>
            <Label label="Type">
              <select {...register('locationType')}>
                <option>OFFICE</option>
                <option>HEADQUARTERS</option>
                <option>STORE</option>
                <option>SERVICE_AREA</option>
                <option>OTHER</option>
              </select>
            </Label>
            <label>
              <input type="checkbox" {...register('isPrimary')} /> Primary active location
            </label>
          </>
        ) : null}
        {kind === 'services' ? (
          <>
            <Label label="Service">
              <input {...register('name')} />
            </Label>
            <Label label="Price type">
              <select {...register('priceType')}>
                <option>QUOTE_REQUIRED</option>
                <option>FIXED</option>
                <option>STARTING_FROM</option>
                <option>RANGE</option>
                <option>FREE</option>
                <option>NOT_DISPLAYED</option>
              </select>
            </Label>
            <Label label="Starting price (minor units)">
              <input {...register('startingPriceMinor')} />
            </Label>
            <Label label="Currency">
              <input {...register('currency')} defaultValue="INR" />
            </Label>
          </>
        ) : null}
        {kind === 'social-links' ? (
          <>
            <Label label="Platform">
              <select {...register('platform')}>
                <option>INSTAGRAM</option>
                <option>GOOGLE_BUSINESS_PROFILE</option>
                <option>FACEBOOK</option>
                <option>LINKEDIN</option>
                <option>YOUTUBE</option>
                <option>X</option>
                <option>WHATSAPP</option>
                <option>OTHER</option>
              </select>
            </Label>
            <Label label="URL">
              <input type="url" {...register('url')} />
            </Label>
          </>
        ) : null}
        {kind === 'hours' ? (
          <Label label="Opening-hour intervals (JSON)">
            <textarea rows={6} {...register('hours')} />
          </Label>
        ) : null}
        <button
          className="min-h-11 rounded-md bg-[var(--accent)] px-5 font-semibold text-white disabled:opacity-50"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? 'Saving…' : 'Save'}
        </button>
      </form>
      {message ? <p role="status">{message}</p> : null}
      {kind !== 'hours' ? (
        <ul className="space-y-2">
          {items.map((item) => (
            <li className="rounded-md border border-[var(--line)] p-3" key={String(item.id)}>
              {String(item.name ?? item.platform ?? item.url)}
            </li>
          ))}
        </ul>
      ) : null}
      {Object.keys(errors).length ? (
        <p role="alert" className="text-red-800">
          Check the form values.
        </p>
      ) : null}
    </section>
  )
}
function Label({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block font-medium">
      {label}
      <span className="mt-2 block [&_input]:min-h-11 [&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:px-3 [&_select]:min-h-11 [&_select]:w-full [&_select]:rounded-md [&_select]:border [&_select]:px-3 [&_textarea]:w-full [&_textarea]:rounded-md [&_textarea]:border [&_textarea]:p-3">
        {children}
      </span>
    </label>
  )
}
