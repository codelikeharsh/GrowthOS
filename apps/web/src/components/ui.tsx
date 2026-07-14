import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  const style =
    variant === 'primary'
      ? 'ui-button'
      : variant === 'secondary'
        ? 'ui-button-secondary'
        : 'ui-button-secondary border-red-300 text-red-800'
  return <button className={`${style} ${className}`} type={type} {...props} />
}

export function Card({ className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`ui-card ${className}`} {...props} />
}

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'success' | 'warning' | 'error'
  children: ReactNode
}) {
  const toneClass = tone === 'neutral' ? '' : ` ui-badge-${tone}`
  return <span className={`ui-badge${toneClass}`}>{children}</span>
}

export function StatusIndicator({ status }: { status: string }) {
  const tone = /COMPLETED|ACTIVE|SUCCESS/i.test(status)
    ? 'success'
    : /PARTIAL|PENDING|QUEUED/i.test(status)
      ? 'warning'
      : /FAILED|DISABLED|CANCELLED|ERROR/i.test(status)
        ? 'error'
        : 'neutral'
  return <Badge tone={tone}>{status}</Badge>
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-label="Loading" className={`ui-skeleton ${className}`} />
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="ui-empty">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function ErrorState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">
      {children}
    </p>
  )
}
