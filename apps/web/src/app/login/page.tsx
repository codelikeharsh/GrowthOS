import Link from 'next/link'
import { AuthCard } from '../../components/auth-card'

export const metadata = { title: 'Sign in' }

export default function LoginPage() {
  return (
    <AuthCard
      title="Sign in"
      introduction="Use your verified Growth OS account."
      endpoint="/auth/login"
      submitLabel="Sign in"
      successHref="/app"
      fields={[
        { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
        { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password' },
      ]}
    >
      <div className="mt-6 flex justify-between text-sm">
        <Link href="/register">Create account</Link>
        <Link href="/forgot-password">Forgot password?</Link>
      </div>
    </AuthCard>
  )
}
