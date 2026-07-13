'use client'
import { useEffect, useState } from 'react'
import { apiRequest } from '../lib/api'
import { useActiveOrganization } from '../lib/use-active-organization'
interface Relationship {
  id: string
  status: string
  servicePlan: string | null
  agencyOrganization: { name: string }
  primaryAccountManager: { displayName: string } | null
}
export function BusinessRelationship() {
  const { organization } = useActiveOrganization('BUSINESS')
  const [relationship, setRelationship] = useState<Relationship>()
  const [error, setError] = useState('')
  useEffect(() => {
    if (!organization) return
    const controller = new AbortController()
    apiRequest<Relationship>('/business-profile/relationship', {
      headers: { 'x-organization-id': organization.id },
      signal: controller.signal,
    })
      .then(setRelationship)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : 'Unable to load relationship')
      })
    return () => controller.abort()
  }, [organization])
  if (error) return <p role="alert">{error}</p>
  if (!relationship) return <p>Loading relationship…</p>
  return (
    <section className="rounded-xl border border-[var(--line)] bg-white p-6">
      <p className="text-sm font-semibold text-[var(--accent)]">{relationship.status}</p>
      <h2 className="mt-1 text-2xl font-semibold">{relationship.agencyOrganization.name}</h2>
      <p className="mt-3 text-[var(--muted)]">
        {relationship.servicePlan ?? 'No service plan'} ·{' '}
        {relationship.primaryAccountManager?.displayName ?? 'Unassigned'}
      </p>
    </section>
  )
}
