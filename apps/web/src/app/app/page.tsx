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
        <div className="space-y-7">
          <section className="ui-panel overflow-hidden p-6 sm:p-8">
            <p className="ui-eyebrow">Today in GrowthOS</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Welcome back, {user.displayName}.
            </h2>
            <p className="mt-2 text-[var(--muted)]">
              Choose a workspace below or create the organisation that anchors your next client
              engagement.
            </p>
          </section>
          <div className="grid gap-7 lg:grid-cols-[1.2fr_.8fr]">
            <section className="ui-card p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">Your workspaces</h2>
                <span className="ui-badge">{organizations.length} total</span>
              </div>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {organizations.map((organization) => (
                  <li
                    key={organization.id}
                    className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-raised)] p-4 transition hover:border-[var(--accent)]"
                  >
                    <strong>{organization.name}</strong>
                    <br />
                    <span className="ui-badge mt-3">
                      {organization.type} · {organization.role}
                    </span>
                  </li>
                ))}
                {!organizations.length ? (
                  <li className="ui-empty sm:col-span-2">
                    <h3 className="font-semibold">Start with your organisation</h3>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      Create an agency or business workspace to unlock its real data.
                    </p>
                  </li>
                ) : null}
              </ul>
            </section>
            <section className="ui-card p-6">
              <h2 className="text-xl font-semibold">Create organization</h2>
              <form className="mt-5 space-y-4" onSubmit={create}>
                <label className="block font-medium">
                  Name
                  <input
                    className="mt-2 min-h-11 w-full rounded-md border px-3"
                    name="name"
                    required
                  />
                </label>
                <label className="block font-medium">
                  Type
                  <select className="mt-2 min-h-11 w-full rounded-md border px-3" name="type">
                    <option value="AGENCY">Agency</option>
                    <option value="BUSINESS">Business</option>
                  </select>
                </label>
                <button className="ui-button" type="submit">
                  Create
                </button>
              </form>
              {error ? (
                <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">
                  {error}
                </p>
              ) : null}
            </section>
          </div>
        </div>
      )}
    </ProtectedPage>
  )
}
