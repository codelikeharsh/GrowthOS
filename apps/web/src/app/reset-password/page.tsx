import { AuthCard } from '../../components/auth-card'

export const metadata = { title: 'Reset password' }

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token = '' } = await searchParams
  return (
    <AuthCard
      title="Choose a new password"
      introduction="Completing this reset revokes every previous session and signs you in securely."
      endpoint="/auth/reset-password"
      submitLabel="Reset password"
      hidden={{ token }}
      successHref="/app"
      successLabel="Open workspace"
      fields={[
        { name: 'password', label: 'New password', type: 'password', autoComplete: 'new-password' },
      ]}
    />
  )
}
