import { Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'

import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/ui'
import { rememberPrefs } from '../lib/supabase'

export function Login() {
  const { session, isAdmin, signIn } = useAuth()
  const [email, setEmail] = useState(rememberPrefs.email)
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(rememberPrefs.get)
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session && isAdmin) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    // Must be set before signing in — it decides where the new session is stored.
    rememberPrefs.set(remember, email.trim())
    setError(await signIn(email.trim(), password))
    setBusy(false)
  }

  const inputCls =
    'h-11 w-full rounded-xl border border-line bg-white pr-3.5 pl-10 text-sm shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 focus:outline-none'

  return (
    <div className="grid min-h-full lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-brand-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-16 size-80 rounded-full bg-brand-700/30" />
        <div className="relative flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-white text-xl font-black text-brand-700">E</div>
          <span className="text-xl font-extrabold">Eizi</span>
        </div>
        <div className="relative">
          <h1 className="text-4xl leading-tight font-bold tracking-tight">
            Run your home-services
            <br />
            marketplace with confidence.
          </h1>
          <p className="mt-4 max-w-md text-brand-200">
            Review new sign-ups, manage service categories and provider listings, and keep every booking on track — all in one place.
          </p>
        </div>
        <p className="relative text-xs text-brand-300">Restricted area · Authorised administrators only</p>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6">
        <form onSubmit={onSubmit} className="w-full max-w-sm">
          <div className="mb-8 flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
            <ShieldCheck className="size-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Admin sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Use your Eizi administrator account.</p>

          {error ? <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">Email</span>
              <span className="relative block">
                <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
                <input type="email" name="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@eizi.app" className={inputCls} />
              </span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">Password</span>
              <span className="relative block">
                <Lock className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  name="password"
                  type={show ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className={`${inputCls} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                  className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </span>
            </label>
          </div>

          <label className="mt-5 flex cursor-pointer items-center gap-2.5 select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="size-4.5 cursor-pointer rounded border-slate-300 accent-brand-700"
            />
            <span className="text-sm font-medium text-slate-700">Remember me</span>
            <span className="text-xs text-slate-400">— stay signed in on this device</span>
          </label>

          <Button type="submit" loading={busy} className="mt-6 h-11 w-full">
            Sign in
          </Button>
        </form>
      </div>
    </div>
  )
}
