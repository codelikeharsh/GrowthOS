'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiRequest } from '../lib/api'

export function AppNav() {
  const router = useRouter()

  async function logout(): Promise<void> {
    await apiRequest('/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <nav
      aria-label="Application"
      className="flex flex-wrap items-center gap-4 border-b border-[var(--line)] pb-5 text-sm font-semibold"
    >
      <Link href="/app">Workspace</Link>
      <Link href="/app/settings/profile">Profile</Link>
      <Link href="/app/settings/organization">Organization</Link>
      <Link href="/app/settings/members">Members</Link>
      <button
        className="ml-auto rounded-md border border-[var(--line)] px-3 py-2"
        onClick={logout}
        type="button"
      >
        Sign out
      </button>
    </nav>
  )
}
