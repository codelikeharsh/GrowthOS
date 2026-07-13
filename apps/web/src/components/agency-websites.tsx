'use client'

import { useParams } from 'next/navigation'
import { useMemo } from 'react'
import { useActiveOrganization } from '../lib/use-active-organization'
import { WebsiteDetail, WebsiteList, type WebsiteContext } from './website-manager'

function useContext(): WebsiteContext | undefined {
  const params = useParams<{ relationshipId: string }>()
  const { organization } = useActiveOrganization('AGENCY')
  return useMemo(
    () =>
      organization
        ? {
            headers: {
              'x-agency-organization-id': organization.id,
              'x-relationship-id': params.relationshipId,
            },
            detailBase: `/app/clients/${params.relationshipId}/websites`,
          }
        : undefined,
    [organization, params.relationshipId],
  )
}

export function AgencyWebsiteList() {
  const context = useContext()
  if (!context) return <p>Loading agency workspace…</p>
  return <WebsiteList context={context} />
}

export function AgencyWebsiteDetail() {
  const params = useParams<{ websiteId: string }>()
  const context = useContext()
  if (!context) return <p>Loading agency workspace…</p>
  return (
    <WebsiteDetail context={context} websiteId={params.websiteId} listHref={context.detailBase} />
  )
}
