'use client'
import { AgencyAuditDetail } from '../../../../../../../../components/agency-websites'
import { ProtectedPage } from '../../../../../../../../components/protected-page'
export default function Page() {
  return <ProtectedPage title="Audit status">{() => <AgencyAuditDetail />}</ProtectedPage>
}
