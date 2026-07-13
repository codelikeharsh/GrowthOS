'use client'

import { BusinessResourceManager } from '../../../../components/business-resource-manager'
import { ProtectedPage } from '../../../../components/protected-page'
export default function Page() {
  return (
    <ProtectedPage title="Business locations">
      {() => <BusinessResourceManager kind="locations" />}
    </ProtectedPage>
  )
}
