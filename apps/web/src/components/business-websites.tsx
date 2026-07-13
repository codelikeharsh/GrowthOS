'use client'

import { useParams } from 'next/navigation'
import { useMemo } from 'react'
import { useActiveOrganization } from '../lib/use-active-organization'
import { WebsiteDetail, WebsiteList, type WebsiteContext } from './website-manager'

function useContext(): WebsiteContext | undefined {
  const { organization } = useActiveOrganization('BUSINESS')
  return useMemo(
    () =>
      organization
        ? {
            headers: { 'x-organization-id': organization.id },
            detailBase: '/app/business/websites',
          }
        : undefined,
    [organization],
  )
}

export function BusinessWebsiteList() {
  const context = useContext()
  if (!context) return <p>Loading business workspace…</p>
  return <WebsiteList context={context} />
}

export function BusinessWebsiteDetail() {
  const params = useParams<{ websiteId: string }>()
  const context = useContext()
  if (!context) return <p>Loading business workspace…</p>
  return (
    <WebsiteDetail context={context} websiteId={params.websiteId} listHref={context.detailBase} />
  )
}
