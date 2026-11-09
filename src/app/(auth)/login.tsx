import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { AuthShell } from '@/components/AuthHeader';
import { Button, Checkbox, Input } from '@/components/ui';
import { clearSavedLogin, loadSavedLogin, saveLogin } from '@/lib/credentials';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);

  // Pre-fill the form if the user ticked "Remember me" last time.
  useEffect(() => {
    let active = true;
    loadSavedLogin().then((saved) => {
      if (!active || !saved) return;
      setEmail(saved.email);
      setPassword(saved.password);
      setRemember(true);
    });
    return () => {
      active = false;
    };
  }, []);

  async function onLogin() {
    if (!email.trim() || !password) {
      Alert.alert('Missing details', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setLoading(false);
      Alert.alert('Login failed', error.message);
      return;
    }
    if (remember) await saveLogin({ email: email.trim(), password });
    else await clearSavedLogin();
    setLoading(false);
    // The (auth) layout sees the new session and redirects.
  }

  return (
    <AuthShell
      title={'Ghar ki har service,\nek tap door.'}
      subtitle="Cooks, electricians, cleaners and more — booked by the hour."
      footer={
        <View className="flex-row justify-center">
          <Text className="text-[15px] text-slate-500">New to Eizi? </Text>
          <Link href="/signup" className="text-[15px] font-bold text-brand-700">
            Create an account
          </Link>
        </View>
      }
    >
      <Text className="mb-1 text-2xl font-bold text-ink">Welcome back</Text>
      <Text className="mb-6 text-[15px] text-slate-500">Log in to continue</Text>

      <View className="gap-4">
        <Input
          label="Email"
          icon="mail-outline"
          placeholder="you@example.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Input
          label="Password"
          icon="lock-closed-outline"
          placeholder="Your password"
          secureTextEntry
          autoComplete="password"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={onLogin}
        />

        <Checkbox checked={remember} onChange={setRemember} label="Remember me" />

        <Button title="Log in" onPress={onLogin} loading={loading} className="mt-2" />
      </View>
    </AuthShell>
  );
}
