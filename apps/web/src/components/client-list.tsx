'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { apiRequest } from '../lib/api'
import { useActiveOrganization } from '../lib/use-active-organization'

interface Client {
  id: string
  status: string
  servicePlan: string | null
  createdAt: string
  business: { name: string; profile?: { tradeName: string | null } }
  accountManager: { displayName: string } | null
  invitation: { status: string } | null
}
interface Member {
  user: { id: string; displayName: string }
}

export function ClientList() {
  const {
    organization,
    loading: contextLoading,
    error: contextError,
  } = useActiveOrganization('AGENCY')
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [accountManagerUserId, setAccountManagerUserId] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!organization) return
    const controller = new AbortController()
    const params = new URLSearchParams({
      limit: '20',
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
      ...(accountManagerUserId ? { accountManagerUserId } : {}),
    })
    apiRequest<{ clients: Client[] }>(`/agency-clients?${params}`, {
      headers: { 'x-organization-id': organization.id },
      signal: controller.signal,
    })
      .then(({ clients: result }) => setClients(result))
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : 'Unable to load clients')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [accountManagerUserId, organization, search, status])

  useEffect(() => {
    if (!organization) return
    const controller = new AbortController()
    apiRequest<{ members: Member[] }>(`/organizations/${organization.id}/members`, {
      signal: controller.signal,
    })
      .then(({ members: result }) => setMembers(result))
      .catch(() => undefined)
    return () => controller.abort()
  }, [organization])

  if (contextLoading) return <p>Loading agency workspace…</p>
  if (!organization)
    return (
      <p role="alert">{contextError || 'Create an agency organization before adding clients.'}</p>
    )

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grow font-medium">
          Search clients
          <input
            className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] px-3"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Business or trade name"
            value={search}
          />
        </label>
        <label className="font-medium">
          Status
          <select
            className="mt-2 block min-h-11 rounded-md border border-[var(--line)] px-3"
            onChange={(event) => setStatus(event.target.value)}
            value={status}
          >
            <option value="">All</option>
            <option>PENDING</option>
            <option>ACTIVE</option>
            <option>SUSPENDED</option>
            <option>TERMINATED</option>
          </select>
        </label>
        <label className="font-medium">
          Account manager
          <select
            className="mt-2 block min-h-11 rounded-md border border-[var(--line)] px-3"
            onChange={(event) => setAccountManagerUserId(event.target.value)}
            value={accountManagerUserId}
          >
            <option value="">All</option>
            {members.map((member) => (
              <option key={member.user.id} value={member.user.id}>
                {member.user.displayName}
              </option>
            ))}
          </select>
        </label>
        <Link
          className="min-h-11 rounded-md bg-[var(--accent)] px-5 py-3 font-semibold text-white"
          href="/app/clients/new"
        >
          New client
        </Link>
      </div>
      {error ? (
        <p role="alert" className="text-red-800">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p>Loading clients…</p>
      ) : clients.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] p-8 text-center">
          <h2 className="text-xl font-semibold">No clients found</h2>
          <p className="mt-2 text-[var(--muted)]">
            Create a real business client to begin onboarding.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-3">Business</th>
                <th className="p-3">Status</th>
                <th className="p-3">Account manager</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Invitation</th>
                <th className="p-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr className="border-t border-[var(--line)]" key={client.id}>
                  <td className="p-3">
                    <Link
                      className="font-semibold text-[var(--accent)]"
                      href={`/app/clients/${client.id}`}
                    >
                      {client.business.name}
                    </Link>
                    {client.business.profile?.tradeName ? (
                      <span className="block text-[var(--muted)]">
                        {client.business.profile.tradeName}
                      </span>
                    ) : null}
                  </td>
                  <td className="p-3">{client.status}</td>
                  <td className="p-3">{client.accountManager?.displayName ?? 'Unassigned'}</td>
                  <td className="p-3">{client.servicePlan ?? '—'}</td>
                  <td className="p-3">{client.invitation?.status ?? 'Not invited'}</td>
                  <td className="p-3">{new Date(client.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
