import { AuthCard } from '../../components/auth-card'

export const metadata = { title: 'Accept invitation' }

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token = '' } = await searchParams
  return (
    <AuthCard
      title="Accept organization invitation"
      introduction="If you already have the invited account, sign in first. New users can create their account here."
      endpoint="/invitations/accept"
      submitLabel="Accept invitation"
      hidden={{ token }}
      successHref="/app"
      successLabel="Open workspace"
      fields={[
        { name: 'displayName', label: 'Name (new accounts)', type: 'text', autoComplete: 'name' },
        {
          name: 'password',
          label: 'Password (new accounts)',
          type: 'password',
          autoComplete: 'new-password',
        },
      ]}
    />
  )
}
