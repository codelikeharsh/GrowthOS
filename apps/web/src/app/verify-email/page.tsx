import { AuthCard } from '../../components/auth-card'

export const metadata = { title: 'Verify email' }

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token = '' } = await searchParams
  return (
    <AuthCard
      title="Verify your email"
      introduction="Confirm this time-limited email verification link."
      endpoint="/auth/verify-email"
      submitLabel="Verify email"
      hidden={{ token }}
      successHref="/login"
      successLabel="Continue to sign in"
      fields={[]}
    />
  )
}
