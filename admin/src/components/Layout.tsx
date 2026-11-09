import {
  BriefcaseBusiness,
  CalendarCheck,
  LayoutDashboard,
  Layers,
  LogOut,
  Menu,
  ShieldCheck,
  Inbox,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'

import { useAuth } from '../auth/AuthProvider'
import { Avatar } from './ui'

const NAV: { to: string; label: string; icon: LucideIcon; hint: string }[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, hint: 'Today at a glance' },
  { to: '/admin/users', label: 'Users', icon: Users, hint: 'Customers & providers' },
  { to: '/admin/services', label: 'Services', icon: Layers, hint: 'Categories' },
  { to: '/admin/listings', label: 'Provider listings', icon: BriefcaseBusiness, hint: 'Who offers what' },
  { to: '/admin/bookings', label: 'Bookings', icon: CalendarCheck, hint: 'All orders' },
  { to: '/admin/wallet', label: 'Wallet', icon: Wallet, hint: 'Top-ups, withdrawals & balances' },
  { to: '/admin/messages', label: 'Messages', icon: Inbox, hint: 'From the website contact form' },
]

export function Layout() {
  const { session, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [today] = useState(() =>
    new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  )
  const { pathname } = useLocation()
  const current = NAV.find((n) => (n.to === '/admin' ? pathname === '/admin' : pathname.startsWith(n.to)))
  const email = session?.user.email ?? ''

  const sidebar = (
    <div className="flex h-full flex-col bg-brand-950 text-white">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex size-10 items-center justify-center rounded-xl bg-white text-lg font-black text-brand-700 shadow-lg">E</div>
        <div>
          <p className="text-lg leading-tight font-extrabold tracking-tight">Eizi</p>
          <p className="flex items-center gap-1 text-[11px] font-semibold tracking-wider text-brand-300 uppercase">
            <ShieldCheck className="size-3" /> Admin portal
          </p>
        </div>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2">
        <p className="px-3 pb-2 text-[11px] font-bold tracking-widest text-brand-400/80 uppercase">Manage</p>
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/admin'}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              [
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                isActive ? 'bg-white text-brand-800 shadow-lg' : 'text-brand-100/80 hover:bg-white/8 hover:text-white',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={[
                    'flex size-8 items-center justify-center rounded-lg transition',
                    isActive ? 'bg-brand-700 text-white' : 'bg-white/5 text-brand-200 group-hover:bg-white/10',
                  ].join(' ')}
                >
                  <Icon className="size-4" />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="m-3 rounded-2xl bg-white/5 p-3">
        <div className="flex items-center gap-3">
          <Avatar name={email} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{email}</p>
            <p className="text-[11px] text-brand-300">Administrator</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-white/10 py-2 text-sm font-semibold transition hover:bg-red-500/90"
        >
          <LogOut className="size-4" /> Log out
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-full">
      {/* Desktop sidebar — sticks to the viewport while the page scrolls */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block">{sidebar}</aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="animate-fade-in absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="animate-pop-in relative h-full w-72 shadow-pop">
            {sidebar}
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute top-5 right-3 cursor-pointer rounded-lg p-1.5 text-brand-200 hover:bg-white/10"
            >
              <X className="size-5" />
            </button>
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200/70 bg-white/85 px-4 backdrop-blur sm:px-6">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="cursor-pointer rounded-xl p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          >
            <Menu className="size-5" />
          </button>
          <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-2 text-sm">
            <span className="hidden font-medium text-slate-400 sm:inline">Admin</span>
            <span className="hidden text-slate-300 sm:inline">/</span>
            <span className="truncate font-semibold text-ink">{current?.label ?? 'Admin'}</span>
            {current?.hint ? <span className="hidden truncate text-slate-400 md:inline">· {current.hint}</span> : null}
          </nav>
          <span className="hidden text-xs font-medium text-slate-500 sm:block">
            {today}
          </span>
        </header>

        <main className="flex-1">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
