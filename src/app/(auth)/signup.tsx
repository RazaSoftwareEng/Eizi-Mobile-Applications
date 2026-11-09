import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { AuthShell } from '@/components/AuthHeader';
import { Button, Input } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export default function Signup() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSignup() {
    if (!fullName.trim() || !email.trim() || password.length < 6) {
      Alert.alert('Check your details', 'Name and email are required, and the password needs at least 6 characters.');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim(), phone: phone.trim() || null } },
    });
    setLoading(false);

    if (error) {
      Alert.alert('Sign up failed', error.message);
      return;
    }
    if (!data.session) {
      // "Confirm email" is turned on in Supabase → user must verify first.
      Alert.alert('Confirm your email', 'We sent you a link. Open it, then log in.');
      router.replace('/login');
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Book trusted help — or start earning with your skills."
      footer={
        <View className="flex-row justify-center">
          <Text className="text-[15px] text-slate-500">Already have an account? </Text>
          <Link href="/login" className="text-[15px] font-bold text-brand-700">
            Log in
          </Link>
        </View>
      }
    >
      <View className="gap-4">
        <Input label="Full name" icon="person-outline" placeholder="Ali Raza" value={fullName} onChangeText={setFullName} autoComplete="name" />
        <Input
          label="Phone number"
          icon="call-outline"
          placeholder="03xx xxxxxxx"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          autoComplete="tel"
          hint="Optional — helps the other person reach you about a booking."
        />
        <Input
          label="Email"
          icon="mail-outline"
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          autoComplete="email"
        />
        <Input
          label="Password"
          icon="lock-closed-outline"
          placeholder="At least 6 characters"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          autoComplete="new-password"
        />
        <Button title="Create account" onPress={onSignup} loading={loading} className="mt-3" />
      </View>
    </AuthShell>
  );
}
