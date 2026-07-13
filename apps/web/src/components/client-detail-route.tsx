'use client'
import { useParams } from 'next/navigation'
import { ClientDetail } from './client-detail'
export function ClientDetailRoute() {
  const { relationshipId } = useParams<{ relationshipId: string }>()
  return <ClientDetail relationshipId={relationshipId} />
}
