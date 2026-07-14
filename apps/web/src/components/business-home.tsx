'use client'
import Link from 'next/link'
import { useActiveOrganization } from '../lib/use-active-organization'
export function BusinessHome() {
  const { organization, loading, error } = useActiveOrganization('BUSINESS')
  if (loading) return <div className="ui-skeleton h-56" aria-label="Loading business workspace" />
  if (!organization)
    return (
      <div className="ui-empty" role="alert">
        {error || 'No business membership is available.'}
      </div>
    )
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <section className="ui-panel p-6">
        <h2 className="text-2xl font-semibold">{organization.name}</h2>
        <p className="mt-2 text-[var(--muted)]">
          Manage the real profile fields shared with your agency.
        </p>
      </section>
      <nav className="ui-card grid gap-2 p-6" aria-label="Business profile">
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
