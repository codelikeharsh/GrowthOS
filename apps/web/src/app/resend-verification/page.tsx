import Link from 'next/link'
import { AuthCard } from '../../components/auth-card'

export const metadata = { title: 'Resend verification' }

export default function ResendVerificationPage() {
  return (
    <AuthCard
      title="Resend verification email"
      introduction="Enter your account email and we will send a new verification link if one is needed."
      endpoint="/auth/resend-verification"
      submitLabel="Resend verification"
      fields={[{ name: 'email', label: 'Email', type: 'email', autoComplete: 'email' }]}
    >
      <p className="mt-6 text-sm">
        <Link href="/login">Back to sign in</Link>
      </p>
    </AuthCard>
  )
}
