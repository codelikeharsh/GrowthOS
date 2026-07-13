'use client'

import { BusinessHome } from '../../../components/business-home'
import { ProtectedPage } from '../../../components/protected-page'
export default function Page() {
  return <ProtectedPage title="Business workspace">{() => <BusinessHome />}</ProtectedPage>
}
