'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { ProtectedPage } from '../../components/protected-page'
import { apiRequest } from '../../lib/api'

interface Organization {
  id: string
  name: string
  slug: string
  type: string
  role: string
}

export default function ApplicationPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [error, setError] = useState('')

  async function load(): Promise<void> {
    const result = await apiRequest<{ organizations: Organization[] }>('/organizations')
    setOrganizations(result.organizations)
  }

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<{ organizations: Organization[] }>('/organizations', { signal: controller.signal })
      .then((result) => setOrganizations(result.organizations))
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : 'Unable to load')
      })
    return () => controller.abort()
  }, [])

  async function create(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form).entries())
    try {
      await apiRequest('/organizations', { method: 'POST', body: JSON.stringify(values) })
      form.reset()
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create organization')
    }
  }

  return (
    <ProtectedPage title="Workspace">
      {(user) => (
        <div className="grid gap-7 md:grid-cols-2">
          <section className="rounded-xl border border-[var(--line)] bg-white p-6">
            <h2 className="text-xl font-semibold">Welcome, {user.displayName}</h2>
            <p className="mt-2 text-[var(--muted)]">
              Your organizations and assigned roles are shown below.
            </p>
            <ul className="mt-5 space-y-3">
              {organizations.map((organization) => (
                <li key={organization.id} className="rounded-md border border-[var(--line)] p-3">
                  <strong>{organization.name}</strong>
                  <br />
                  <span className="text-sm text-[var(--muted)]">
                    {organization.type} · {organization.role}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-xl border border-[var(--line)] bg-white p-6">
            <h2 className="text-xl font-semibold">Create organization</h2>
            <form className="mt-5 space-y-4" onSubmit={create}>
              <label className="block font-medium">
                Name
                <input
                  className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] px-3"
                  name="name"
                  required
                />
              </label>
              <label className="block font-medium">
                Type
                <select
                  className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] px-3"
                  name="type"
                >
                  <option value="AGENCY">Agency</option>
                  <option value="BUSINESS">Business</option>
                </select>
              </label>
              <button
                className="min-h-11 rounded-md bg-[var(--accent)] px-5 font-semibold text-white"
                type="submit"
              >
                Create
              </button>
            </form>
            {error ? (
              <p className="mt-4 text-red-800" role="alert">
                {error}
              </p>
            ) : null}
          </section>
        </div>
      )}
    </ProtectedPage>
  )
}
