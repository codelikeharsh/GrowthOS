import { AuthCard } from '../../components/auth-card'

export const metadata = { title: 'Forgot password' }

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      introduction="If the account is eligible, Mailpit will receive a time-limited reset link."
      endpoint="/auth/forgot-password"
      submitLabel="Send reset link"
      successHref="/login"
      successLabel="Return to sign in"
      fields={[{ name: 'email', label: 'Email', type: 'email', autoComplete: 'email' }]}
    />
  )
}
