'use client'

import { AgencyWebsiteList } from '../../../../../components/agency-websites'
import { ProtectedPage } from '../../../../../components/protected-page'

export default function ClientWebsitesPage() {
  return <ProtectedPage title="Client websites">{() => <AgencyWebsiteList />}</ProtectedPage>
}
