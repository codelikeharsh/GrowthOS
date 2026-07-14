import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="overflow-hidden">
      <section className="mx-auto grid min-h-[44rem] max-w-6xl items-center gap-14 px-6 py-20 sm:px-10 lg:grid-cols-[1.05fr_.95fr]">
        <div>
          <p className="ui-eyebrow">Growth intelligence, made operational</p>
          <h1 className="mt-5 max-w-3xl text-5xl leading-[1.02] font-semibold tracking-[-0.045em] sm:text-7xl">
            Your agency’s clearest path from audit to action.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-[var(--muted)]">
            GrowthOS brings client websites, audit evidence, teams, and next actions into one calm,
            accountable workspace.
          </p>
          <nav aria-label="Primary" className="mt-9 flex flex-wrap gap-3">
            <Link href="/register" className="ui-button">
              Create your workspace
            </Link>
            <Link href="/login" className="ui-button-secondary">
              Sign in
            </Link>
          </nav>
        </div>
        <div className="ui-panel relative overflow-hidden p-6 sm:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--accent)] via-[#75c9a6] to-transparent" />
          <p className="ui-eyebrow">Website audit</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            A report your clients can use.
          </h2>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <div className="ui-card p-4">
              <p className="text-sm text-[var(--muted)]">Crawl evidence</p>
              <strong className="mt-2 block text-lg">Registered pages</strong>
            </div>
            <div className="ui-card p-4">
              <p className="text-sm text-[var(--muted)]">Rule-based findings</p>
              <strong className="mt-2 block text-lg">Clear categories</strong>
            </div>
            <div className="ui-card p-4">
              <p className="text-sm text-[var(--muted)]">Report context</p>
              <strong className="mt-2 block text-lg">Shareable outcomes</strong>
            </div>
          </div>
          <div className="mt-5 space-y-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-muted)] p-4 text-sm">
            <p className="font-semibold">A focused report</p>
            <p className="text-[var(--muted)]">
              Group real findings by category, severity, affected page, and evidence.
            </p>
            <p className="font-medium text-[var(--accent-strong)]">
              Suggested actions stay deterministic.
            </p>
          </div>
        </div>
      </section>
      <section className="border-y border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-14 sm:grid-cols-3 sm:px-10">
          <div>
            <h2 className="text-lg font-semibold">Secure by design</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Tenant-aware access and evidence-backed workflows.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Built for agencies</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Move from client context to real work without switching tools.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold">No invented insights</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Reports display only persisted crawl data and deterministic findings.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
