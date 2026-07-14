'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { apiRequest } from '../lib/api'

const links = [
  { href: '/app', label: 'Overview' },
  { href: '/app/clients', label: 'Clients' },
  { href: '/app/business', label: 'Business' },
  { href: '/app/settings/organization', label: 'Organization' },
  { href: '/app/settings/members', label: 'Team' },
  { href: '/app/settings/profile', label: 'Profile' },
]

export function AppNav({ user }: { user: { displayName: string; email: string } }) {
  const router = useRouter()
  const pathname = usePathname()

  async function logout(): Promise<void> {
    await apiRequest('/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <header className="border-b border-[var(--line)] bg-[#18231d] text-white shadow-sm">
      <div className="mx-auto flex w-[min(100%-2rem,76rem)] flex-wrap items-center gap-3 py-3 sm:py-4">
        <Link className="mr-auto font-semibold tracking-tight no-underline" href="/app">
          <span className="mr-2 inline-flex size-6 items-center justify-center rounded-md bg-[var(--accent)] text-xs">
            G
          </span>
          GrowthOS
        </Link>
        <span className="hidden rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 sm:inline">
          Workspace
        </span>
        <span className="hidden text-right text-xs text-white/65 md:block">
          <strong className="block font-semibold text-white">{user.displayName}</strong>
          {user.email}
        </span>
        <button
          className="rounded-md border border-white/20 px-3 py-2 text-sm font-semibold hover:bg-white/10"
          onClick={logout}
          type="button"
        >
          Sign out
        </button>
      </div>
      <nav
        aria-label="Application"
        className="mx-auto flex w-[min(100%-2rem,76rem)] gap-1 overflow-x-auto pb-3"
      >
        {links.map((link) => {
          const active =
            link.href === '/app' ? pathname === link.href : pathname.startsWith(link.href)
          return (
            <Link
              className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold no-underline transition ${
                active
                  ? 'bg-white text-[#18231d]'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
