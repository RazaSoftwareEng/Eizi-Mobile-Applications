import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

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

  async function onForgot() {
    const target = email.trim();
    if (!target.includes('@')) {
      Alert.alert('Enter your email', 'Type the email you signed up with, then tap "Forgot Password?" again.');
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(target);
    if (error) Alert.alert('Could not send email', error.message);
    else Alert.alert('Check your email', `We sent a password reset link to ${target}.`);
  }

  return (
    <AuthShell
      title="Welcome Back"
      subtitle="Login to book home services anytime, anywhere."
      footer={
        <View className="flex-row justify-center">
          <Text className="text-[15px] text-slate-500">Don&apos;t have an account? </Text>
          <Link href="/signup" className="text-[15px] font-bold text-brand-700">
            Sign Up
          </Link>
        </View>
      }
    >
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

        <View className="flex-row items-center justify-between">
          <Checkbox checked={remember} onChange={setRemember} label="Remember me" />
          <Pressable onPress={onForgot} hitSlop={8} accessibilityRole="button">
            <Text className="text-[14px] font-semibold text-brand-700">Forgot Password?</Text>
          </Pressable>
        </View>

        <Button title="Login" onPress={onLogin} loading={loading} className="mt-2" />
      </View>
    </AuthShell>
  );
}
