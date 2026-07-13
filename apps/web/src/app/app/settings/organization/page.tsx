'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { ProtectedPage } from '../../../../components/protected-page'
import { apiRequest } from '../../../../lib/api'

interface Organization {
  id: string
  name: string
  type: string
  role: string
}

export default function OrganizationSettingsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<{ organizations: Organization[] }>('/organizations', { signal: controller.signal })
      .then((result) => setOrganizations(result.organizations))
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  return (
    <ProtectedPage title="Organization settings">
      {() => (
        <section className="max-w-xl rounded-xl border border-[var(--line)] bg-white p-6">
          <form
            className="space-y-4"
            onSubmit={async (event: FormEvent<HTMLFormElement>) => {
              event.preventDefault()
              const values = Object.fromEntries(new FormData(event.currentTarget).entries())
              const organizationId = String(values.organizationId)
              await apiRequest(`/organizations/${organizationId}`, {
                method: 'PATCH',
                body: JSON.stringify({ name: values.name }),
              })
              setMessage('Organization name updated.')
            }}
          >
            <label className="block font-medium">
              Organization
              <select
                className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] px-3"
                name="organizationId"
                required
              >
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name} · {organization.role}
                  </option>
                ))}
              </select>
            </label>
            <label className="block font-medium">
              New name
              <input
                className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] px-3"
                name="name"
                required
              />
            </label>
            <button
              className="min-h-11 rounded-md bg-[var(--accent)] px-5 font-semibold text-white"
              type="submit"
            >
              Update organization
            </button>
          </form>
          {message ? (
            <p className="mt-4 text-emerald-800" role="status">
              {message}
            </p>
          ) : null}
        </section>
      )}
    </ProtectedPage>
  )
}
