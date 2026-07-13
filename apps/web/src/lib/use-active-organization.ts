'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from './api'

export interface OrganizationSummary {
  id: string
  name: string
  type: 'AGENCY' | 'BUSINESS'
  role: string
}

export function useActiveOrganization(type: OrganizationSummary['type']) {
  const [organization, setOrganization] = useState<OrganizationSummary>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<{ organizations: OrganizationSummary[] }>('/organizations', {
      signal: controller.signal,
    })
      .then(({ organizations }) =>
        setOrganization(organizations.find((item) => item.type === type)),
      )
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : 'Unable to load organizations')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [type])

  return { organization, loading, error }
}

export function businessHeaders(organizationId: string): HeadersInit {
  return { 'x-organization-id': organizationId }
}

export function agencyBusinessHeaders(agencyId: string, relationshipId: string): HeadersInit {
  return { 'x-agency-organization-id': agencyId, 'x-relationship-id': relationshipId }
}
