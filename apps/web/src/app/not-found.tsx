import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-20">
      <p className="text-sm font-semibold tracking-[0.18em] text-[var(--accent)] uppercase">404</p>
      <h1 className="mt-3 text-4xl font-semibold">Page not found</h1>
      <p className="mt-4 text-[var(--muted)]">The requested Growth OS page does not exist.</p>
      <Link href="/" className="mt-8 inline-block font-semibold text-[var(--accent)]">
        Return home
      </Link>
    </main>
  )
}
