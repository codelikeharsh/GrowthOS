'use client'

import Link from 'next/link'
import { type FormEvent, type ReactNode, useState } from 'react'
import { apiRequest } from '../lib/api'

interface AuthCardProps {
  title: string
  introduction: string
  endpoint: string
  submitLabel: string
  fields: ReadonlyArray<{
    name: string
    label: string
    type: 'email' | 'password' | 'text'
    autoComplete: string
    defaultValue?: string
  }>
  hidden?: Record<string, string>
  successHref?: string
  successLabel?: string
  children?: ReactNode
}

export function AuthCard({
  title,
  introduction,
  endpoint,
  submitLabel,
  fields,
  hidden,
  successHref,
  successLabel,
  children,
}: AuthCardProps) {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setPending(true)
    setError('')
    const values = Object.fromEntries(new FormData(event.currentTarget).entries())
    try {
      const result = await apiRequest<{ message?: string }>(endpoint, {
        method: 'POST',
        body: JSON.stringify({ ...values, ...hidden }),
      })
      setMessage(result.message ?? 'Complete.')
      if (successHref && endpoint === '/auth/login') window.location.assign(successHref)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Request failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_80%_0%,#e1f2e8_0,transparent_28rem)] px-5 py-10 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col justify-center">
        <Link href="/" className="mb-9 text-sm font-semibold text-[var(--accent)] no-underline">
          <span className="mr-2 inline-flex size-6 items-center justify-center rounded-md bg-[var(--accent)] text-xs text-white">
            G
          </span>
          GrowthOS
        </Link>
        <section className="ui-panel p-7 sm:p-8">
          <p className="ui-eyebrow">Secure workspace access</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-3 leading-7 text-[var(--muted)]">{introduction}</p>
          <form className="mt-7 space-y-5" onSubmit={submit}>
            {fields.map((field) => (
              <label key={field.name} className="block font-medium">
                {field.label}
                <input
                  className="mt-2 min-h-11 w-full rounded-md border px-3"
                  name={field.name}
                  type={field.type}
                  autoComplete={field.autoComplete}
                  defaultValue={field.defaultValue}
                  required
                />
              </label>
            ))}
            <button
              className="ui-button w-full disabled:opacity-60"
              disabled={pending}
              type="submit"
            >
              {pending ? 'Working…' : submitLabel}
            </button>
          </form>
          {message ? (
            <p className="mt-5 rounded-md bg-emerald-50 p-3 text-sm text-emerald-900" role="status">
              {message}{' '}
              {successHref && endpoint !== '/auth/login' ? (
                <Link href={successHref}>{successLabel}</Link>
              ) : null}
            </p>
          ) : null}
          {error ? (
            <p className="mt-5 rounded-md bg-red-50 p-3 text-sm text-red-900" role="alert">
              {error}
            </p>
          ) : null}
          {children}
        </section>
      </div>
    </main>
  )
}
