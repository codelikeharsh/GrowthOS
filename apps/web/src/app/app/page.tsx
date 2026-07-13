import Link from 'next/link'

export const metadata = { title: 'Application status' }

export default function ApplicationPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-20 sm:px-10">
      <Link href="/" className="text-sm font-semibold text-[var(--accent)]">
        ← Back to overview
      </Link>
      <p className="mt-12 text-sm font-semibold tracking-[0.18em] text-[var(--accent)] uppercase">
        Not yet available
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
        The product workspace begins in Phase 2.
      </h1>
      <div className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6">
        <h2 className="text-xl font-semibold">Current boundary</h2>
        <p className="mt-3 leading-7 text-[var(--muted)]">
          Authentication, organisations, memberships, permissions, and product modules have not been
          implemented. This route intentionally contains no fake dashboard or production metrics.
        </p>
      </div>
    </main>
  )
}
