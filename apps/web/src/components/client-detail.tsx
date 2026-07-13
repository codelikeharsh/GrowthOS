'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { apiRequest } from '../lib/api'
import { useActiveOrganization } from '../lib/use-active-organization'

interface Props {
  relationshipId: string
}
interface Client {
  id: string
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED'
  servicePlan: string | null
  version: number
  business: {
    name: string
    profile?: { legalName: string; tradeName: string | null; timezone: string; currency: string }
  }
  accountManager: { displayName: string } | null
  invitation: { id: string; status: string; email: string } | null
}
interface Invitation {
  id: string
  email: string
  status: string
  expiresAt: string
  createdAt: string
}
const inviteSchema = z.object({ email: z.email() })

export function ClientDetail({ relationshipId }: Props) {
  const { organization } = useActiveOrganization('AGENCY')
  const [client, setClient] = useState<Client>()
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [error, setError] = useState('')
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
    reset,
  } = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '' },
  })
  async function load(): Promise<void> {
    if (!organization) return
    try {
      const [clientResult, invitationResult] = await Promise.all([
        apiRequest<Client>(`/agency-clients/${relationshipId}`, {
          headers: { 'x-organization-id': organization.id },
        }),
        apiRequest<Invitation[]>(`/agency-clients/${relationshipId}/invitations`, {
          headers: { 'x-organization-id': organization.id },
        }),
      ])
      setClient(clientResult)
      setInvitations(invitationResult)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load client')
    }
  }
  useEffect(() => {
    if (!organization) return
    const controller = new AbortController()
    Promise.all([
      apiRequest<Client>(`/agency-clients/${relationshipId}`, {
        headers: { 'x-organization-id': organization.id },
        signal: controller.signal,
      }),
      apiRequest<Invitation[]>(`/agency-clients/${relationshipId}/invitations`, {
        headers: { 'x-organization-id': organization.id },
        signal: controller.signal,
      }),
    ])
      .then(([clientResult, invitationResult]) => {
        setClient(clientResult)
        setInvitations(invitationResult)
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : 'Unable to load client')
      })
    return () => controller.abort()
  }, [organization, relationshipId])
  async function transition(status: Client['status']): Promise<void> {
    if (!organization || !client) return
    try {
      await apiRequest(`/agency-clients/${relationshipId}/status`, {
        method: 'PATCH',
        headers: { 'x-organization-id': organization.id },
        body: JSON.stringify({ status, version: client.version }),
      })
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to change status')
    }
  }
  async function invite(values: z.infer<typeof inviteSchema>): Promise<void> {
    if (!organization) return
    try {
      await apiRequest(`/agency-clients/${relationshipId}/invitations`, {
        method: 'POST',
        headers: { 'x-organization-id': organization.id },
        body: JSON.stringify(values),
      })
      reset()
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to invite owner')
    }
  }
  async function resendInvitation(invitationId: string): Promise<void> {
    if (!organization) return
    try {
      await apiRequest(`/agency-clients/${relationshipId}/invitations/${invitationId}/resend`, {
        method: 'POST',
        headers: { 'x-organization-id': organization.id },
      })
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to resend invitation')
    }
  }
  async function revokeInvitation(invitationId: string): Promise<void> {
    if (!organization) return
    try {
      await apiRequest(`/agency-clients/${relationshipId}/invitations/${invitationId}`, {
        method: 'DELETE',
        headers: { 'x-organization-id': organization.id },
      })
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to revoke invitation')
    }
  }
  if (error)
    return (
      <p role="alert" className="text-red-800">
        {error}
      </p>
    )
  if (!client || !organization) return <p>Loading client…</p>
  const base = `/app/clients/${relationshipId}`
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[var(--line)] bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[var(--accent)]">{client.status}</p>
            <h2 className="mt-1 text-2xl font-semibold">{client.business.name}</h2>
            <p className="mt-2 text-[var(--muted)]">
              {client.servicePlan ?? 'No service plan'} ·{' '}
              {client.accountManager?.displayName ?? 'Unassigned'}
            </p>
          </div>
          <div className="flex gap-2">
            {client.status === 'PENDING' ? (
              <button onClick={() => transition('ACTIVE')} className="rounded-md border px-3 py-2">
                Activate
              </button>
            ) : null}
            {client.status === 'ACTIVE' ? (
              <button
                onClick={() => transition('SUSPENDED')}
                className="rounded-md border px-3 py-2"
              >
                Suspend
              </button>
            ) : null}
            {client.status === 'SUSPENDED' ? (
              <button onClick={() => transition('ACTIVE')} className="rounded-md border px-3 py-2">
                Reactivate
              </button>
            ) : null}
            {client.status !== 'TERMINATED' ? (
              <button
                onClick={() => transition('TERMINATED')}
                className="rounded-md border border-red-300 px-3 py-2 text-red-800"
              >
                Terminate
              </button>
            ) : null}
          </div>
        </div>
      </section>
      <nav className="flex flex-wrap gap-3 text-sm font-semibold" aria-label="Client record">
        <Link href={base}>Overview</Link>
        <Link href={`${base}/profile`}>Profile</Link>
        <Link href={`${base}/locations`}>Locations</Link>
        <Link href={`${base}/services`}>Services</Link>
        <Link href={`${base}/hours`}>Hours</Link>
        <Link href={`${base}/social-links`}>Social links</Link>
        <Link href={`${base}/notes`}>Notes</Link>
        <Link href={`${base}/members`}>Members</Link>
      </nav>
      <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-xl border border-[var(--line)] bg-white p-6">
          <h3 className="text-lg font-semibold">Profile completion</h3>
          <p className="mt-2 text-[var(--muted)]">
            {client.business.profile
              ? `Legal identity, ${client.business.profile.timezone}, and ${client.business.profile.currency} are configured.`
              : 'Profile unavailable for this relationship state.'}
          </p>
        </section>
        <form
          className="rounded-xl border border-[var(--line)] bg-white p-6"
          onSubmit={handleSubmit(invite)}
        >
          <h3 className="text-lg font-semibold">Client owner invitation</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {client.invitation
              ? `${client.invitation.email} · ${client.invitation.status}`
              : 'No pending invitation.'}
          </p>
          <label className="mt-4 block font-medium">
            Owner email
            <input
              className="mt-2 min-h-11 w-full rounded-md border px-3"
              type="email"
              {...register('email')}
            />
          </label>
          <button
            className="mt-4 min-h-11 rounded-md bg-[var(--accent)] px-4 font-semibold text-white"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Inviting…' : 'Invite owner'}
          </button>
          {invitations.length ? (
            <ul className="mt-5 divide-y divide-[var(--line)] text-sm">
              {invitations.map((invitation) => (
                <li className="py-3" key={invitation.id}>
                  <span className="font-medium">{invitation.email}</span>
                  <span className="ml-2 text-[var(--muted)]">{invitation.status}</span>
                  {invitation.status === 'PENDING' ? (
                    <span className="mt-2 flex gap-2">
                      <button
                        className="rounded-md border px-3 py-2"
                        onClick={() => void resendInvitation(invitation.id)}
                        type="button"
                      >
                        Resend
                      </button>
                      <button
                        className="rounded-md border border-red-300 px-3 py-2 text-red-800"
                        onClick={() => void revokeInvitation(invitation.id)}
                        type="button"
                      >
                        Revoke
                      </button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </form>
      </div>
    </div>
  )
}
