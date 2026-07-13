'use client'

import { BusinessProfileEditor } from '../../../../components/business-profile-editor'
import { ProtectedPage } from '../../../../components/protected-page'
export default function Page() {
  return <ProtectedPage title="Business profile">{() => <BusinessProfileEditor />}</ProtectedPage>
}
