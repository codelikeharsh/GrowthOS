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
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <Link href="/" className="mb-10 text-sm font-semibold text-[var(--accent)]">
        ← Growth OS
      </Link>
      <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-7 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 leading-7 text-[var(--muted)]">{introduction}</p>
        <form className="mt-7 space-y-5" onSubmit={submit}>
          {fields.map((field) => (
            <label key={field.name} className="block font-medium">
              {field.label}
              <input
                className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] bg-white px-3"
                name={field.name}
                type={field.type}
                autoComplete={field.autoComplete}
                defaultValue={field.defaultValue}
                required
              />
            </label>
          ))}
          <button
            className="min-h-11 w-full rounded-md bg-[var(--accent)] px-5 font-semibold text-white disabled:opacity-60"
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
    </main>
  )
}
