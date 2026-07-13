'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from './api'

export interface CurrentUser {
  id: string
  email: string
  displayName: string
}

export function useSession(): { user?: CurrentUser; loading: boolean; error?: string } {
  const [user, setUser] = useState<CurrentUser>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<CurrentUser>('/me', { signal: controller.signal })
      .then(setUser)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : 'Authentication required')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])
  return { ...(user ? { user } : {}), loading, ...(error ? { error } : {}) }
}
