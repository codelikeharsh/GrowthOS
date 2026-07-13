'use client'

import { ClientDetailRoute } from '../../../../components/client-detail-route'
import { ProtectedPage } from '../../../../components/protected-page'
export default function ClientPage() {
  return <ProtectedPage title="Client record">{() => <ClientDetailRoute />}</ProtectedPage>
}
