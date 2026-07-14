import Link from 'next/link'
import { AuthCard } from '../../components/auth-card'

export const metadata = { title: 'Register' }

export default function RegisterPage() {
  return (
    <AuthCard
      title="Create your account"
      introduction="Use at least 12 characters with uppercase, lowercase, a number, and a symbol."
      endpoint="/auth/register"
      submitLabel="Register"
      fields={[
        { name: 'displayName', label: 'Name', type: 'text', autoComplete: 'name' },
        { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
        { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password' },
      ]}
    >
      <p className="mt-6 text-sm">
        Already registered? <Link href="/login">Sign in</Link>
      </p>
      <p className="mt-2 text-sm">
        Missing a verification email? <Link href="/resend-verification">Resend verification</Link>
      </p>
    </AuthCard>
  )
}
