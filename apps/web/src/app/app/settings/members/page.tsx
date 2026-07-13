'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { ProtectedPage } from '../../../../components/protected-page'
import { apiRequest } from '../../../../lib/api'

interface Organization {
  id: string
  name: string
}
interface Member {
  id: string
  user: { id: string; email: string; displayName: string }
  role: { name: string }
}

export default function MemberSettingsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selected, setSelected] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [message, setMessage] = useState('')

  async function loadMembers(organizationId: string): Promise<void> {
    if (!organizationId) return
    const result = await apiRequest<{ members: Member[] }>(
      `/organizations/${organizationId}/members`,
    )
    setMembers(result.members)
  }

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<{ organizations: Organization[] }>('/organizations', { signal: controller.signal })
      .then((result) => {
        setOrganizations(result.organizations)
        const first = result.organizations[0]?.id ?? ''
        setSelected(first)
        return loadMembers(first)
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  async function invite(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form).entries())
    await apiRequest(`/organizations/${selected}/invitations`, {
      method: 'POST',
      body: JSON.stringify(values),
    })
    form.reset()
    setMessage('Invitation sent to Mailpit.')
  }

  return (
    <ProtectedPage title="Member settings">
      {() => (
        <div className="space-y-7">
          <label className="block max-w-xl font-medium">
            Organization
            <select
              className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] px-3"
              value={selected}
              onChange={(event) => {
                setSelected(event.target.value)
                void loadMembers(event.target.value)
              }}
            >
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </label>
          <section className="max-w-xl rounded-xl border border-[var(--line)] bg-white p-6">
            <h2 className="text-xl font-semibold">Invite member</h2>
            <form className="mt-5 space-y-4" onSubmit={invite}>
              <label className="block font-medium">
                Email
                <input
                  className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] px-3"
                  name="email"
                  type="email"
                  required
                />
              </label>
              <label className="block font-medium">
                Role
                <select
                  className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] px-3"
                  name="role"
                >
                  <option value="ADMIN">Admin</option>
                  <option value="MEMBER">Member</option>
                  <option value="VIEWER">Viewer</option>
                </select>
              </label>
              <button
                className="min-h-11 rounded-md bg-[var(--accent)] px-5 font-semibold text-white"
                type="submit"
                disabled={!selected}
              >
                Send invitation
              </button>
            </form>
            {message ? (
              <p className="mt-4 text-emerald-800" role="status">
                {message}
              </p>
            ) : null}
          </section>
          <section className="rounded-xl border border-[var(--line)] bg-white p-6">
            <h2 className="text-xl font-semibold">Current members</h2>
            <ul className="mt-5 divide-y divide-[var(--line)]">
              {members.map((member) => (
                <li key={member.id} className="flex flex-wrap items-center gap-3 py-4">
                  <span className="mr-auto">
                    <strong>{member.user.displayName}</strong>
                    <br />
                    <span className="text-sm text-[var(--muted)]">{member.user.email}</span>
                  </span>
                  <select
                    aria-label={`Role for ${member.user.displayName}`}
                    value={member.role.name}
                    onChange={async (event) => {
                      await apiRequest(`/organizations/${selected}/members/${member.id}/role`, {
                        method: 'PATCH',
                        body: JSON.stringify({ role: event.target.value }),
                      })
                      await loadMembers(selected)
                    }}
                  >
                    <option value="OWNER">Owner</option>
                    <option value="ADMIN">Admin</option>
                    <option value="MEMBER">Member</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                  <button
                    className="rounded-md border border-red-300 px-3 py-2 text-red-800"
                    type="button"
                    onClick={async () => {
                      await apiRequest(`/organizations/${selected}/members/${member.id}`, {
                        method: 'DELETE',
                      })
                      await loadMembers(selected)
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </ProtectedPage>
  )
}
