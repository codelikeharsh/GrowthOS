import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-20 sm:px-10">
      <p className="mb-4 text-sm font-semibold tracking-[0.18em] text-[var(--accent)] uppercase">
        Secure identity foundation
      </p>
      <h1 className="max-w-3xl text-5xl leading-tight font-semibold tracking-tight sm:text-7xl">
        One secure workspace for agency growth operations.
      </h1>
      <p className="mt-7 max-w-2xl text-lg leading-8 text-[var(--muted)]">
        Create a verified account, organise your team, assign roles, and manage secure sessions.
        Product modules remain outside this phase.
      </p>
      <nav aria-label="Primary" className="mt-10">
        <Link
          href="/app"
          className="inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-5 py-3 font-semibold text-white no-underline"
        >
          Open Growth OS
        </Link>
      </nav>
    </main>
  )
}
