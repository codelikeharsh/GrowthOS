'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '../lib/api'

interface Props {
  agencyId: string
  relationshipId: string
}
interface Member {
  user: { id: string; email: string; displayName: string }
  role: { name: string }
}
interface Relationship {
  version: number
  accountManager: { id: string; displayName: string } | null
}

export function AccountManagerPanel({ agencyId, relationshipId }: Props) {
  const [members, setMembers] = useState<Member[]>([])
  const [relationship, setRelationship] = useState<Relationship>()
  const [selected, setSelected] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function refreshRelationship(): Promise<void> {
    const result = await apiRequest<Relationship>(`/agency-clients/${relationshipId}`, {
      headers: { 'x-organization-id': agencyId },
    })
    setRelationship(result)
    setSelected(result.accountManager?.id ?? '')
  }

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      apiRequest<{ members: Member[] }>(`/organizations/${agencyId}/members`, {
        signal: controller.signal,
      }),
      apiRequest<Relationship>(`/agency-clients/${relationshipId}`, {
        headers: { 'x-organization-id': agencyId },
        signal: controller.signal,
      }),
    ])
      .then(([memberResult, relationshipResult]) => {
        setMembers(memberResult.members)
        setRelationship(relationshipResult)
        setSelected(relationshipResult.accountManager?.id ?? '')
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : 'Unable to load account managers')
      })
    return () => controller.abort()
  }, [agencyId, relationshipId])

  async function assign(): Promise<void> {
    if (!relationship) return
    setError('')
    setMessage('')
    try {
      await apiRequest(`/agency-clients/${relationshipId}/account-manager`, {
        method: 'PATCH',
        headers: { 'x-organization-id': agencyId },
        body: JSON.stringify({ userId: selected || null, version: relationship.version }),
      })
      await refreshRelationship()
      setMessage(selected ? 'Account manager assigned.' : 'Account manager removed.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to assign account manager')
    }
  }

  return (
    <section className="max-w-2xl rounded-xl border border-[var(--line)] bg-white p-6">
      <h2 className="text-xl font-semibold">Account manager</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Assign an active agency member as the primary owner of this client relationship.
      </p>
      <label className="mt-5 block font-medium">
        Agency member
        <select
          className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] px-3"
          onChange={(event) => setSelected(event.target.value)}
          value={selected}
        >
          <option value="">Unassigned</option>
          {members.map((member) => (
            <option key={member.user.id} value={member.user.id}>
              {member.user.displayName} · {member.role.name}
            </option>
          ))}
        </select>
      </label>
      <button
        className="mt-4 min-h-11 rounded-md bg-[var(--accent)] px-4 font-semibold text-white"
        disabled={!relationship}
        onClick={() => void assign()}
        type="button"
      >
        Save assignment
      </button>
      {message ? <p className="mt-4 text-emerald-800">{message}</p> : null}
      {error ? (
        <p className="mt-4 text-red-800" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}
