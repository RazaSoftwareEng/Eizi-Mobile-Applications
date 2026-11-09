import { Loader2, Search, X, type LucideIcon } from 'lucide-react'
import {
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

import { initials } from '../lib/format'
import type { BookingStatus, Role } from '../lib/types'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

/* ---------------------------------------------------------------- Button */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  icon?: LucideIcon
  loading?: boolean
}

export function Button({ variant = 'primary', size = 'md', icon: Icon, loading, className, children, disabled, ...rest }: ButtonProps) {
  const styles = {
    primary: 'bg-brand-700 text-white shadow-brand hover:bg-brand-800',
    secondary: 'border border-line bg-white text-ink shadow-sm hover:bg-slate-50',
    ghost: 'text-slate-600 hover:bg-slate-100 hover:text-ink',
    danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
  }[variant]
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        'inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl font-semibold transition focus-visible:ring-4 focus-visible:ring-brand-500/20 focus-visible:outline-none active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
        size === 'md' ? 'h-10 px-4 text-sm' : 'h-8 px-3 text-[13px]',
        styles,
        className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon ? <Icon className="size-4" /> : null}
      {children}
    </button>
  )
}

export function IconButton({ icon: Icon, label, tone = 'default', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon
  label: string
  tone?: 'default' | 'danger'
}) {
  return (
    <button
      {...rest}
      title={label}
      aria-label={label}
      className={cx(
        'inline-flex size-8 cursor-pointer items-center justify-center rounded-lg transition',
        tone === 'danger' ? 'text-slate-400 hover:bg-red-50 hover:text-red-600' : 'text-slate-400 hover:bg-brand-50 hover:text-brand-700',
      )}
    >
      <Icon className="size-4" />
    </button>
  )
}

/* ---------------------------------------------------------------- Inputs */

const fieldCls =
  'w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink shadow-sm transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 focus:outline-none disabled:bg-slate-50'

function Field({ label, hint, id, children }: { label?: string; hint?: string; id: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={id} className="block text-[13px] font-semibold text-slate-700">
          {label}
        </label>
      ) : null}
      {children}
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  )
}

export function TextField({ label, hint, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string }) {
  const id = useId()
  return (
    <Field label={label} hint={hint} id={id}>
      <input id={id} {...rest} className={cx(fieldCls, 'h-10', className)} />
    </Field>
  )
}

export function TextArea({ label, hint, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; hint?: string }) {
  const id = useId()
  return (
    <Field label={label} hint={hint} id={id}>
      <textarea id={id} rows={3} {...rest} className={cx(fieldCls, 'py-2.5')} />
    </Field>
  )
}

export function SelectField({ label, hint, children, className, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; hint?: string }) {
  const id = useId()
  return (
    <Field label={label} hint={hint} id={id}>
      <select id={id} {...rest} className={cx(fieldCls, 'h-10 cursor-pointer pr-8', className)}>
        {children}
      </select>
    </Field>
  )
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cx(fieldCls, 'h-10 pl-9')}
      />
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition',
        checked ? 'bg-brand-600' : 'bg-slate-300',
      )}
    >
      <span className={cx('inline-block size-5 rounded-full bg-white shadow transition', checked ? 'translate-x-5.5' : 'translate-x-0.5')} />
    </button>
  )
}

/* ---------------------------------------------------------------- Layout bits */

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-2xl border border-slate-200/70 bg-white shadow-card', className)}>{children}</div>
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cx('flex items-center justify-center py-16', className)}>
      <Loader2 className="size-7 animate-spin text-brand-600" />
    </div>
  )
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-50">
        <Icon className="size-6 text-brand-600" />
      </div>
      <p className="font-semibold text-ink">{title}</p>
      {text ? <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <span>{message}</span>
      {onRetry ? (
        <button onClick={onRetry} className="cursor-pointer font-semibold underline">
          Retry
        </button>
      ) : null}
    </div>
  )
}

export function Avatar({ name, size = 'md' }: { name: string | null | undefined; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-700',
        size === 'md' ? 'size-9 text-xs' : 'size-7 text-[11px]',
      )}
    >
      {initials(name)}
    </span>
  )
}

/* ---------------------------------------------------------------- Badges */

const statusStyle: Record<BookingStatus, { cls: string; dot: string; label: string }> = {
  pending: { cls: 'bg-amber-50 text-amber-700 ring-amber-600/15', dot: 'bg-amber-500', label: 'Pending' },
  accepted: { cls: 'bg-sky-50 text-sky-700 ring-sky-600/15', dot: 'bg-sky-500', label: 'Confirmed' },
  rejected: { cls: 'bg-red-50 text-red-700 ring-red-600/15', dot: 'bg-red-500', label: 'Declined' },
  completed: { cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15', dot: 'bg-emerald-500', label: 'Completed' },
  cancelled: { cls: 'bg-slate-100 text-slate-600 ring-slate-500/15', dot: 'bg-slate-400', label: 'Cancelled' },
}

export function StatusBadge({ status }: { status: BookingStatus }) {
  const s = statusStyle[status]
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', s.cls)}>
      <span className={cx('size-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  )
}

export function RoleBadge({ role }: { role: Role | null }) {
  // Dot colours match the dashboard chart series (customers = blue, providers = orange).
  const map = {
    customer: { label: 'Customer', dot: '#2a78d6', cls: 'bg-blue-50 ring-blue-600/15' },
    provider: { label: 'Provider', dot: '#eb6834', cls: 'bg-orange-50 ring-orange-600/15' },
  }
  if (!role) return <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-slate-500">Not chosen</span>
  const r = map[role]
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-slate-700 ring-1 ring-inset', r.cls)}>
      <span className="size-1.5 rounded-full" style={{ background: r.dot }} />
      {r.label}
    </span>
  )
}

export function NewBadge() {
  return <span className="rounded-md bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">New</span>
}

/* ---------------------------------------------------------------- Modal */

export function Modal({ open, title, subtitle, onClose, children, footer, width = 'max-w-lg' }: {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="animate-fade-in absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cx('animate-pop-in relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-pop sm:rounded-2xl', width)}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-ink">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          <IconButton icon={X} label="Close" onClick={onClose} />
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4 sm:rounded-b-2xl">{footer}</div> : null}
      </div>
    </div>
  )
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', onConfirm, onClose }: {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  onConfirm: () => Promise<void> | void
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      width="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await onConfirm()
              } finally {
                setBusy(false)
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-6 text-slate-600">{message}</div>
    </Modal>
  )
}

/* ---------------------------------------------------------------- Table */

export function Table({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] md:min-w-0 text-left text-sm">
        <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold tracking-wide text-slate-500 uppercase">
          {head}
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  )
}

export const Th = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <th className={cx('px-4 py-3 font-semibold whitespace-nowrap', className)}>{children}</th>
)
export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <td className={cx('px-4 py-3 align-middle', className)}>{children}</td>
)

export function Tabs<T extends string>({ value, onChange, options }: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; count?: number }[]
}) {
  return (
    <div className="inline-flex flex-wrap gap-0.5 rounded-xl bg-slate-200/60 p-1" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap transition',
            o.value === value ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-ink',
          )}
        >
          {o.label}
          {o.count !== undefined ? (
            <span className={cx('rounded-full px-1.5 text-[11px]', o.value === value ? 'bg-brand-600 text-white' : 'bg-slate-300/80 text-slate-600')}>
              {o.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  )
}
