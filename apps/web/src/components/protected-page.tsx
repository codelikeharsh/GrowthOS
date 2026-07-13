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
  if (loading) return <main className="p-10">Loading workspace…</main>
  if (!user || error) {
    return (
      <main className="mx-auto max-w-xl p-10">
        <h1 className="text-3xl font-semibold">Sign in required</h1>
        <p className="mt-4 text-[var(--muted)]">Your session is missing or has expired.</p>
        <Link className="mt-6 inline-block font-semibold text-[var(--accent)]" href="/login">
          Continue to sign in
        </Link>
      </main>
    )
  }
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <AppNav />
      <h1 className="mt-10 text-4xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-7">{children(user)}</div>
    </main>
  )
}
