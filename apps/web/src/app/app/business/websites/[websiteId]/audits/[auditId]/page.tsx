'use client'
import { BusinessAuditDetail } from '../../../../../../../components/business-websites'
import { ProtectedPage } from '../../../../../../../components/protected-page'
export default function Page() {
  return <ProtectedPage title="Audit status">{() => <BusinessAuditDetail />}</ProtectedPage>
}
