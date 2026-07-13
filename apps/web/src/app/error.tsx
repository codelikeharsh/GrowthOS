'use client'

export default function GlobalError({
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-20">
      <h1 className="text-3xl font-semibold">Something went wrong</h1>
      <p className="mt-4 text-[var(--muted)]">
        The page could not be displayed safely. Try the request again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 min-h-11 rounded-md bg-[var(--accent)] px-5 py-3 font-semibold text-white"
      >
        Try again
      </button>
    </main>
  )
}
