'use client'

import { BusinessRelationship } from '../../../../components/business-relationship'
import { RelationshipNotes } from '../../../../components/relationship-notes'
import { ProtectedPage } from '../../../../components/protected-page'
export default function Page() {
  return (
    <ProtectedPage title="Agency relationship">
      {() => (
        <div className="space-y-6">
          <BusinessRelationship />
          <RelationshipNotes businessMode />
        </div>
      )}
    </ProtectedPage>
  )
}
