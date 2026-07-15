import type { ReactNode } from 'react'
import { requireServerSession } from '../../lib/server-session'

/** Server-side guard for every application route. Client components still use
 * `/me` after hydration, while this prevents a shared-domain session from
 * being lost during the post-login server navigation. */
export default async function ApplicationLayout({ children }: Readonly<{ children: ReactNode }>) {
  await requireServerSession()
  return children
}
