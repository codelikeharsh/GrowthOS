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

const schema = z.object({
  legalName: z.string().min(1).max(160),
  tradeName: z.string().max(160).optional(),
  shortDescription: z.string().max(300).optional(),
  description: z.string().max(5000).optional(),
  industry: z.string().max(120).optional(),
  phone: z.union([z.literal(''), z.string().regex(/^\+[1-9]\d{6,14}$/)]),
  email: z.union([z.literal(''), z.email()]),
  websiteDisplayUrl: z.union([z.literal(''), z.url()]),
  timezone: z.string().min(1),
  currency: z.string().regex(/^[A-Z]{3}$/),
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  primaryLanguage: z.string().regex(/^[a-z]{2,3}(-[A-Z]{2})?$/),
  version: z.number(),
})
type Values = z.infer<typeof schema>
interface Props {
  agencyId?: string
  relationshipId?: string
}

export function BusinessProfileEditor({ agencyId, relationshipId }: Props) {
  const {
    organization,
    loading: contextLoading,
    error: contextError,
  } = useActiveOrganization('BUSINESS')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError: formError,
  } = useForm<Values>({ resolver: zodResolver(schema) })
  const headers = useMemo(
    () =>
      agencyId && relationshipId
        ? agencyBusinessHeaders(agencyId, relationshipId)
        : organization
          ? businessHeaders(organization.id)
          : undefined,
    [agencyId, relationshipId, organization],
  )

  useEffect(() => {
    if (!headers) return
    const controller = new AbortController()
    apiRequest<Values>('/business-profile', { headers, signal: controller.signal })
      .then((profile) =>
        reset({
          ...profile,
          tradeName: profile.tradeName ?? '',
          shortDescription: profile.shortDescription ?? '',
          description: profile.description ?? '',
          industry: profile.industry ?? '',
          phone: profile.phone ?? '',
          email: profile.email ?? '',
          websiteDisplayUrl: profile.websiteDisplayUrl ?? '',
        }),
      )
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : 'Unable to load profile')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [headers, reset])

  async function submit(values: Values): Promise<void> {
    if (!headers) return
    try {
      const profile = await apiRequest<Values>('/business-profile', {
        method: 'PATCH',
        headers,
        body: JSON.stringify(values),
      })
      reset({
        ...profile,
        tradeName: profile.tradeName ?? '',
        shortDescription: profile.shortDescription ?? '',
        description: profile.description ?? '',
        industry: profile.industry ?? '',
        phone: profile.phone ?? '',
        email: profile.email ?? '',
        websiteDisplayUrl: profile.websiteDisplayUrl ?? '',
      })
    } catch (cause) {
      formError('root', {
        message: cause instanceof Error ? cause.message : 'Unable to save profile',
      })
    }
  }
  if (!agencyId && contextLoading) return <p>Loading business workspace…</p>
  if (!agencyId && !organization)
    return <p role="alert">{contextError || 'A business organization is required.'}</p>
  if (loading) return <p>Loading profile…</p>
  if (error)
    return (
      <p role="alert" className="text-red-800">
        {error}
      </p>
    )
  return (
    <form
      className="max-w-2xl space-y-4 rounded-xl border border-[var(--line)] bg-white p-6"
      onSubmit={handleSubmit(submit)}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Legal name"
          {...(errors.legalName?.message ? { error: errors.legalName.message } : {})}
        >
          <input {...register('legalName')} />
        </Field>
        <Field label="Trade name">
          <input {...register('tradeName')} />
        </Field>
      </div>
      <Field label="Short description">
        <input {...register('shortDescription')} />
      </Field>
      <Field label="Description">
        <textarea rows={5} {...register('description')} />
      </Field>
      <Field label="Industry">
        <input {...register('industry')} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone">
          <input {...register('phone')} placeholder="+15551234567" />
        </Field>
        <Field label="Email">
          <input type="email" {...register('email')} />
        </Field>
        <Field label="Website">
          <input type="url" {...register('websiteDisplayUrl')} />
        </Field>
        <Field label="Timezone">
          <input {...register('timezone')} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Currency">
          <input {...register('currency')} />
        </Field>
        <Field label="Country">
          <input {...register('countryCode')} />
        </Field>
        <Field label="Language">
          <input {...register('primaryLanguage')} />
        </Field>
      </div>
      {errors.root ? (
        <p role="alert" className="text-red-800">
          {errors.root.message}
        </p>
      ) : null}
      <button
        className="min-h-11 rounded-md bg-[var(--accent)] px-5 font-semibold text-white disabled:opacity-50"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  )
}
function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="block font-medium">
      {label}
      <span className="mt-2 block [&_input]:min-h-11 [&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:px-3 [&_textarea]:w-full [&_textarea]:rounded-md [&_textarea]:border [&_textarea]:p-3">
        {children}
      </span>
      {error ? <span className="text-sm text-red-800">{error}</span> : null}
    </label>
  )
}
