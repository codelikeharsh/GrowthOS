'use client'

import { CreateClientForm } from '../../../../components/create-client-form'
import { ProtectedPage } from '../../../../components/protected-page'
export default function NewClientPage() {
  return <ProtectedPage title="Create business client">{() => <CreateClientForm />}</ProtectedPage>
}
