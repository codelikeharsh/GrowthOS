'use client'

import { useParams } from 'next/navigation'
import { useActiveOrganization } from '../lib/use-active-organization'
import { AccountManagerPanel } from './account-manager-panel'
import { BusinessProfileEditor } from './business-profile-editor'
import { BusinessResourceManager } from './business-resource-manager'
import { RelationshipNotes } from './relationship-notes'

interface Props {
  kind: 'profile' | 'locations' | 'services' | 'hours' | 'social-links' | 'notes' | 'members'
}
export function ClientSubpage({ kind }: Props) {
  const params = useParams<{ relationshipId: string }>()
  const { organization } = useActiveOrganization('AGENCY')
  if (!organization) return <p>Loading agency workspace…</p>
  if (kind === 'profile')
    return (
      <BusinessProfileEditor agencyId={organization.id} relationshipId={params.relationshipId} />
    )
  if (kind === 'notes') return <RelationshipNotes relationshipId={params.relationshipId} />
  if (kind === 'members')
    return <AccountManagerPanel agencyId={organization.id} relationshipId={params.relationshipId} />
  return (
    <BusinessResourceManager
      agencyId={organization.id}
      kind={kind}
      relationshipId={params.relationshipId}
    />
  )
}
