import { Navigate, Route, Routes } from 'react-router'

import { useAuth } from './auth/AuthProvider'
import { Layout } from './components/Layout'
import { Spinner } from './components/ui'
import { Bookings } from './pages/Bookings'
import { Dashboard } from './pages/Dashboard'
import { Listings } from './pages/Listings'
import { Login } from './pages/Login'
import { Services } from './pages/Services'
import { Users } from './pages/Users'

/** Only signed-in admins get past this; everyone else is sent to the login page. */
function RequireAdmin() {
  const { session, isAdmin, loading } = useAuth()
  if (loading) return <Spinner className="h-full" />
  if (!session || !isAdmin) return <Navigate to="/login" replace />
  return <Layout />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAdmin />}>
        <Route index element={<Dashboard />} />
        <Route path="users" element={<Users />} />
        <Route path="services" element={<Services />} />
        <Route path="listings" element={<Listings />} />
        <Route path="bookings" element={<Bookings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
