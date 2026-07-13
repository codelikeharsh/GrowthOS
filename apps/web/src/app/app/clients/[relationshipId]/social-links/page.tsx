'use client'

import { ClientSubpage } from '../../../../../components/client-subpage'
import { ProtectedPage } from '../../../../../components/protected-page'
export default function Page() {
  return (
    <ProtectedPage title="Business social links">
      {() => <ClientSubpage kind="social-links" />}
    </ProtectedPage>
  )
}
