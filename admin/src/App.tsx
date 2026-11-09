import { useEffect } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router'

import { useAuth } from './auth/AuthProvider'
import { Layout } from './components/Layout'
import { SetupNeeded } from './components/SetupNeeded'
import { Spinner } from './components/ui'
import { missingConfig } from './lib/supabase'
import { Bookings } from './pages/Bookings'
import { Dashboard } from './pages/Dashboard'
import { Listings } from './pages/Listings'
import { Login } from './pages/Login'
import { Messages } from './pages/Messages'
import { Services } from './pages/Services'
import { Users } from './pages/Users'
import { Wallet } from './pages/Wallet'
import { usePageMeta } from './site/bits'
import { About } from './site/pages/About'
import { Contact } from './site/pages/Contact'
import { Home } from './site/pages/Home'
import { Layout as SiteLayout } from './site/SiteLayout'

/** Admin area: tab title + "don't index me" for search engines. */
function useAdminMeta() {
  useEffect(() => {
    document.title = 'Eizi Admin'
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])
}

/** Only signed-in admins get past this; everyone else is sent to the admin login page. */
function RequireAdmin() {
  const { session, isAdmin, loading } = useAuth()
  useAdminMeta()
  if (missingConfig) return <SetupNeeded />
  if (loading) return <Spinner className="h-full" />
  if (!session || !isAdmin) return <Navigate to="/admin/login" replace />
  return <Layout />
}

function AdminLogin() {
  useAdminMeta()
  return missingConfig ? <SetupNeeded /> : <Login />
}

function NotFound() {
  usePageMeta('Page not found — Eizi')
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <p className="text-7xl font-black text-brand-200">404</p>
      <h1 className="mt-4 text-3xl font-extrabold text-ink">This page doesn’t exist</h1>
      <p className="mt-2 text-slate-600">The link may be old or mistyped.</p>
      <Link to="/" className="mt-6 rounded-xl bg-brand-700 px-5 py-3 font-bold text-white shadow-brand">
        Back to home
      </Link>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      {/* Public website */}
      <Route element={<SiteLayout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="contact" element={<Contact />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Admin portal */}
      <Route path="admin/login" element={<AdminLogin />} />
      <Route path="login" element={<Navigate to="/admin/login" replace />} />
      <Route path="admin" element={<RequireAdmin />}>
        <Route index element={<Dashboard />} />
        <Route path="users" element={<Users />} />
        <Route path="services" element={<Services />} />
        <Route path="listings" element={<Listings />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="wallet" element={<Wallet />} />
        <Route path="messages" element={<Messages />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  )
}
