'use client'
import Link from 'next/link'
import { useActiveOrganization } from '../lib/use-active-organization'
export function BusinessHome() {
  const { organization, loading, error } = useActiveOrganization('BUSINESS')
  if (loading) return <p>Loading business workspace…</p>
  if (!organization) return <p role="alert">{error || 'No business membership is available.'}</p>
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <section className="rounded-xl border border-[var(--line)] bg-white p-6">
        <h2 className="text-2xl font-semibold">{organization.name}</h2>
        <p className="mt-2 text-[var(--muted)]">
          Manage the real profile fields shared with your agency.
        </p>
      </section>
      <nav
        className="grid gap-2 rounded-xl border border-[var(--line)] bg-white p-6"
        aria-label="Business profile"
      >
        <Link href="/app/business/profile">Profile</Link>
        <Link href="/app/business/locations">Locations</Link>
        <Link href="/app/business/services">Services</Link>
        <Link href="/app/business/hours">Hours</Link>
        <Link href="/app/business/social-links">Social links</Link>
        <Link href="/app/business/websites">Websites</Link>
        <Link href="/app/business/relationship">Agency relationship</Link>
      </nav>
    </div>
  )
}
