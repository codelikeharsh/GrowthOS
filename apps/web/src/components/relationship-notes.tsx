'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { apiRequest } from '../lib/api'
import { useActiveOrganization } from '../lib/use-active-organization'

const schema = z.object({
  visibility: z.enum(['AGENCY_INTERNAL', 'CLIENT_VISIBLE']),
  body: z.string().trim().min(1).max(5000),
})
interface Note {
  id: string
  visibility?: string
  body: string
  createdAt: string
  author: { displayName: string }
}
interface Props {
  relationshipId?: string
  businessMode?: boolean
}

export function RelationshipNotes({ relationshipId, businessMode = false }: Props) {
  const { organization } = useActiveOrganization(businessMode ? 'BUSINESS' : 'AGENCY')
  const [notes, setNotes] = useState<Note[]>([])
  const [error, setError] = useState('')
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { visibility: 'CLIENT_VISIBLE', body: '' },
  })
  const path = businessMode
    ? '/business-profile/relationship/notes'
    : `/agency-clients/${relationshipId}/notes`
  const headers = organization ? { 'x-organization-id': organization.id } : undefined
  async function load(): Promise<void> {
    if (!headers) return
    try {
      const result = await apiRequest<{ notes: Note[] } | Note[]>(path, { headers })
      setNotes(Array.isArray(result) ? result : result.notes)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load notes')
    }
  }
  useEffect(() => {
    if (!organization) return
    const controller = new AbortController()
    apiRequest<{ notes: Note[] } | Note[]>(path, {
      headers: { 'x-organization-id': organization.id },
      signal: controller.signal,
    })
      .then((result) => setNotes(Array.isArray(result) ? result : result.notes))
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : 'Unable to load notes')
      })
    return () => controller.abort()
  }, [organization, path])
  async function submit(values: z.infer<typeof schema>): Promise<void> {
    if (!headers) return
    try {
      await apiRequest(path, {
        method: 'POST',
        headers,
        body: JSON.stringify(businessMode ? { ...values, visibility: 'CLIENT_VISIBLE' } : values),
      })
      reset({ visibility: 'CLIENT_VISIBLE', body: '' })
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to add note')
    }
  }
  if (!organization) return <p>Loading relationship…</p>
  return (
    <section className="space-y-5">
      <form
        className="space-y-4 rounded-xl border border-[var(--line)] bg-white p-6"
        onSubmit={handleSubmit(submit)}
      >
        <h2 className="text-xl font-semibold">Add relationship note</h2>
        {!businessMode ? (
          <label className="block font-medium">
            Visibility
            <select
              className="mt-2 min-h-11 w-full rounded-md border px-3"
              {...register('visibility')}
            >
              <option value="CLIENT_VISIBLE">Client visible</option>
              <option value="AGENCY_INTERNAL">Agency internal</option>
            </select>
          </label>
        ) : null}
        <label className="block font-medium">
          Note
          <textarea className="mt-2 w-full rounded-md border p-3" rows={5} {...register('body')} />
        </label>
        <button
          className="min-h-11 rounded-md bg-[var(--accent)] px-5 font-semibold text-white"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? 'Adding…' : 'Add note'}
        </button>
      </form>
      {error ? (
        <p role="alert" className="text-red-800">
          {error}
        </p>
      ) : null}
      <ul className="space-y-3">
        {notes.map((note) => (
          <li className="rounded-xl border border-[var(--line)] bg-white p-4" key={note.id}>
            <div className="flex justify-between text-sm text-[var(--muted)]">
              <span>{note.author.displayName}</span>
              <span>
                {note.visibility ?? 'CLIENT_VISIBLE'} · {new Date(note.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="mt-3 whitespace-pre-wrap">{note.body}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
