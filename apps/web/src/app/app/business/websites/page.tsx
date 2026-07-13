'use client'

import { BusinessWebsiteList } from '../../../../components/business-websites'
import { ProtectedPage } from '../../../../components/protected-page'

export default function BusinessWebsitesPage() {
  return <ProtectedPage title="Websites">{() => <BusinessWebsiteList />}</ProtectedPage>
}
