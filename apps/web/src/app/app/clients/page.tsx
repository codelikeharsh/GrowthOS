'use client'

import { ClientList } from '../../../components/client-list'
import { ProtectedPage } from '../../../components/protected-page'
export default function ClientsPage() {
  return <ProtectedPage title="Agency clients">{() => <ClientList />}</ProtectedPage>
}
