'use client'

import { type FormEvent, useState } from 'react'
import { ProtectedPage } from '../../../../components/protected-page'
import { apiRequest } from '../../../../lib/api'

export default function ProfileSettingsPage() {
  const [message, setMessage] = useState('')

  return (
    <ProtectedPage title="Profile settings">
      {(user) => (
        <section className="max-w-xl rounded-xl border border-[var(--line)] bg-white p-6">
          <p className="text-sm text-[var(--muted)]">{user.email}</p>
          <form
            className="mt-5 space-y-4"
            onSubmit={async (event: FormEvent<HTMLFormElement>) => {
              event.preventDefault()
              const displayName = String(new FormData(event.currentTarget).get('displayName'))
              const result = await apiRequest<{ displayName: string }>('/me', {
                method: 'PATCH',
                body: JSON.stringify({ displayName }),
              })
              setMessage(`Saved as ${result.displayName}.`)
            }}
          >
            <label className="block font-medium">
              Display name
              <input
                className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] px-3"
                defaultValue={user.displayName}
                name="displayName"
                required
              />
            </label>
            <button
              className="min-h-11 rounded-md bg-[var(--accent)] px-5 font-semibold text-white"
              type="submit"
            >
              Save profile
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
