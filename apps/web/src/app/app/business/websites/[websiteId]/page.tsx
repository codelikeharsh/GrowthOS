'use client'

import { BusinessWebsiteDetail } from '../../../../../components/business-websites'
import { ProtectedPage } from '../../../../../components/protected-page'

export default function BusinessWebsiteDetailPage() {
  return <ProtectedPage title="Website details">{() => <BusinessWebsiteDetail />}</ProtectedPage>
}
