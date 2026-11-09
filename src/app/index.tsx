import { Redirect } from 'expo-router';

import { Loader } from '@/components/ui';
import { useAuth } from '@/providers/AuthProvider';

// Decides where the user lands: login → role picker → customer or provider app.
export default function Index() {
  const { session, profile, loading } = useAuth();

  if (loading) return <Loader />;
  if (!session) return <Redirect href="/login" />;
  if (!profile?.role) return <Redirect href="/role" />;
  return <Redirect href={profile.role === 'provider' ? '/provider' : '/customer'} />;
}
