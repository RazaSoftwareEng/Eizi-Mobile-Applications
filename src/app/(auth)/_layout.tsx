import { Redirect, Stack } from 'expo-router';

import { Loader } from '@/components/ui';
import { useAuth } from '@/providers/AuthProvider';

export default function AuthLayout() {
  const { session, loading } = useAuth();
  if (loading) return <Loader />;
  if (session) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#fff' } }} />;
}
