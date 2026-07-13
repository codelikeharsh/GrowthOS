'use client'

import { AgencyWebsiteDetail } from '../../../../../../components/agency-websites'
import { ProtectedPage } from '../../../../../../components/protected-page'

export default function ClientWebsiteDetailPage() {
  return <ProtectedPage title="Website details">{() => <AgencyWebsiteDetail />}</ProtectedPage>
}
