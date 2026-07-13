'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { apiRequest } from '../lib/api'
import { useActiveOrganization } from '../lib/use-active-organization'

const schema = z.object({
  legalName: z.string().trim().min(1).max(160),
  tradeName: z.string().trim().max(160).optional(),
  servicePlan: z.string().trim().max(120).optional(),
  status: z.enum(['PENDING', 'ACTIVE']),
  timezone: z.string().trim().min(1).max(100),
  currency: z.string().regex(/^[A-Z]{3}$/),
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  clientOwnerEmail: z.union([z.literal(''), z.email()]),
})
type Values = z.infer<typeof schema>

export function CreateClientForm() {
  const router = useRouter()
  const { organization, loading, error: contextError } = useActiveOrganization('AGENCY')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      legalName: '',
      tradeName: '',
      servicePlan: '',
      status: 'ACTIVE',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      countryCode: 'IN',
      clientOwnerEmail: '',
    },
  })

  async function submit(values: Values): Promise<void> {
    if (!organization) return
    try {
      const created = await apiRequest<{ id: string }>('/agency-clients', {
        method: 'POST',
        headers: { 'x-organization-id': organization.id, 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({
          ...values,
          ...(values.clientOwnerEmail ? {} : { clientOwnerEmail: undefined }),
          ...(values.tradeName ? {} : { tradeName: undefined }),
          ...(values.servicePlan ? {} : { servicePlan: undefined }),
        }),
      })
      router.push(`/app/clients/${created.id}`)
    } catch (cause) {
      setError('root', {
        message: cause instanceof Error ? cause.message : 'Unable to create client',
      })
    }
  }

  if (loading) return <p>Loading agency workspace…</p>
  if (!organization)
    return <p role="alert">{contextError || 'An agency organization is required.'}</p>
  return (
    <form
      className="max-w-2xl space-y-5 rounded-xl border border-[var(--line)] bg-white p-6"
      onSubmit={handleSubmit(submit)}
    >
      <p className="text-sm text-[var(--muted)]">
        Creating this client atomically creates its business organization, profile, and agency
        relationship.
      </p>
      <label className="block font-medium">
        Legal name
        <input className="mt-2 min-h-11 w-full rounded-md border px-3" {...register('legalName')} />
        {errors.legalName ? (
          <span className="block text-sm text-red-800">{errors.legalName.message}</span>
        ) : null}
      </label>
      <label className="block font-medium">
        Trade name
        <input className="mt-2 min-h-11 w-full rounded-md border px-3" {...register('tradeName')} />
      </label>
      <label className="block font-medium">
        Service plan
        <input
          className="mt-2 min-h-11 w-full rounded-md border px-3"
          {...register('servicePlan')}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="font-medium">
          Relationship status
          <select className="mt-2 min-h-11 w-full rounded-md border px-3" {...register('status')}>
            <option>ACTIVE</option>
            <option>PENDING</option>
          </select>
        </label>
        <label className="font-medium">
          Client owner email
          <input
            className="mt-2 min-h-11 w-full rounded-md border px-3"
            type="email"
            {...register('clientOwnerEmail')}
          />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="font-medium">
          Timezone
          <input
            className="mt-2 min-h-11 w-full rounded-md border px-3"
            {...register('timezone')}
          />
        </label>
        <label className="font-medium">
          Currency
          <input
            className="mt-2 min-h-11 w-full rounded-md border px-3 uppercase"
            {...register('currency')}
          />
        </label>
        <label className="font-medium">
          Country
          <input
            className="mt-2 min-h-11 w-full rounded-md border px-3 uppercase"
            {...register('countryCode')}
          />
        </label>
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
        {isSubmitting ? 'Creating client…' : 'Create client'}
      </button>
    </form>
  )
}
