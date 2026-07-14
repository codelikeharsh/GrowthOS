'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { AppNav } from './app-nav'
import { useSession } from '../lib/use-session'

interface ProtectedPageProps {
  title: string
  children: (user: { id: string; email: string; displayName: string }) => ReactNode
}

export function ProtectedPage({ title, children }: ProtectedPageProps) {
  const { user, loading, error } = useSession()
  if (loading)
    return (
      <main className="app-content">
        <div aria-label="Loading workspace" className="ui-skeleton h-9 w-48" />
        <div className="ui-skeleton mt-7 h-72" />
      </main>
    )
  if (!user || error) {
    return (
      <main className="app-content max-w-xl">
        <h1 className="text-3xl font-semibold">Sign in required</h1>
        <p className="mt-4 text-[var(--muted)]">Your session is missing or has expired.</p>
        <Link className="mt-6 inline-block font-semibold text-[var(--accent)]" href="/login">
          Continue to sign in
        </Link>
      </main>
    )
  }
  return (
    <div className="app-shell">
      <AppNav user={user} />
      <main className="app-content">
        <p className="ui-eyebrow">GrowthOS workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <div className="mt-7">{children(user)}</div>
      </main>
    </div>
  )
}
