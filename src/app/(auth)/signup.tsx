import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { AuthShell } from '@/components/AuthHeader';
import { Button, Input } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, shadow } from '@/lib/theme';
import type { Role } from '@/lib/types';

const ROLES = [
  { role: 'customer', icon: 'home-heart', title: 'Customer', subtitle: 'I need a service' },
  { role: 'provider', icon: 'account-hard-hat', title: 'Provider', subtitle: 'I offer a service' },
] as const;

export default function Signup() {
  const [role, setRole] = useState<Role | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSignup() {
    if (!role) {
      Alert.alert('Choose account type', 'Tell us if you want to book services or offer them.');
      return;
    }
    if (!fullName.trim() || !email.trim() || password.length < 6) {
      Alert.alert('Check your details', 'Name and email are required, and the password needs at least 6 characters.');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      // The role is saved with the account, so after logging in the user goes straight to their home screen.
      options: { data: { full_name: fullName.trim(), phone: phone.trim() || null, role } },
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
      <Text className="mb-2 text-[13px] font-semibold text-slate-600">I want to join as</Text>
      <View className="mb-6 flex-row gap-3" accessibilityRole="radiogroup">
        {ROLES.map((r) => {
          const active = role === r.role;
          return (
            <Pressable
              key={r.role}
              onPress={() => setRole(r.role)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              className={`flex-1 rounded-2xl border-2 bg-white p-4 ${active ? 'border-brand-600' : 'border-transparent'}`}
              style={active ? shadow.md : shadow.sm}
            >
              <View className="flex-row items-start justify-between">
                <View className={`h-11 w-11 items-center justify-center rounded-xl ${active ? 'bg-brand-700' : 'bg-brand-50'}`}>
                  <MaterialCommunityIcons name={r.icon} size={24} color={active ? colors.white : colors.brandDark} />
                </View>
                <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={active ? colors.brand : colors.line} />
              </View>
              <Text className="mt-3 text-[15px] font-bold text-ink">{r.title}</Text>
              <Text className="text-xs text-slate-500">{r.subtitle}</Text>
            </Pressable>
          );
        })}
      </View>

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
