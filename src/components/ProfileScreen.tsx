import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { Avatar, Button, Card, Input, ListRow } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

export function ProfileScreen() {
  const { session, profile, refreshProfile, signOut } = useAuth();

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState(false);

  if (!session || !profile) return null;

  const isProvider = profile.role === 'provider';
  const otherRole = isProvider ? 'customer' : 'provider';
  const dirty = fullName.trim() !== profile.full_name || (phone.trim() || null) !== (profile.phone ?? null);

  async function onSave() {
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), phone: phone.trim() || null })
      .eq('id', profile!.id);
    await refreshProfile();
    setSaving(false);
    if (error) Alert.alert('Could not save', error.message);
    else Alert.alert('Saved', 'Your profile was updated.');
  }

  async function onSwitchRole() {
    setSwitching(true);
    const { error } = await supabase.from('profiles').update({ role: otherRole }).eq('id', profile!.id);
    if (error) {
      setSwitching(false);
      Alert.alert('Could not switch', error.message);
      return;
    }
    await refreshProfile();
    setSwitching(false);
    router.replace('/');
  }

  function confirmLogout() {
    Alert.alert('Log out?', 'You can log back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: signOut },
    ]);
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-surface" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerClassName="pb-10" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="items-center overflow-hidden rounded-b-[32px] bg-brand-900 px-5 pb-10 pt-4">
          <View className="absolute -right-20 -top-16 h-60 w-60 rounded-full bg-white/5" />
          <View className="rounded-full border-4 border-white/20">
            <Avatar name={profile.full_name} size={84} light />
          </View>
          <Text className="mt-4 text-2xl font-bold text-white">{profile.full_name || 'Your name'}</Text>
          <Text className="mt-1 text-[15px] text-brand-200">{session.user.email}</Text>
          <View className="mt-4 flex-row items-center gap-2 rounded-full bg-white/15 px-4 py-1.5">
            <MaterialCommunityIcons name={isProvider ? 'account-hard-hat' : 'home-heart'} size={15} color={colors.white} />
            <Text className="text-xs font-bold uppercase tracking-wider text-white">
              {isProvider ? 'Service provider' : 'Customer'}
            </Text>
          </View>
        </View>

        <View className="-mt-6 gap-4 px-5">
          {/* Personal info */}
          <Card className="gap-4 p-5">
            <Text className="text-base font-bold text-ink">Personal information</Text>
            <Input label="Full name" icon="person-outline" value={fullName} onChangeText={setFullName} />
            <Input
              label="Phone number"
              icon="call-outline"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="03xx xxxxxxx"
              hint={isProvider && !phone ? 'Add a phone number so customers can reach you.' : undefined}
            />
            <Button title="Save changes" onPress={onSave} loading={saving} disabled={!dirty} />
          </Card>

          {/* Account */}
          <Card className="py-1">
            <ListRow
              icon="swap-horizontal"
              label={isProvider ? 'Switch to customer' : 'Become a service provider'}
              onPress={switching ? undefined : onSwitchRole}
            />
            <View className="ml-[68px] h-px bg-slate-100" />
            <ListRow icon="log-out-outline" label="Log out" danger onPress={confirmLogout} />
          </Card>

          <Text className="mt-2 text-center text-xs text-slate-400">Eizi · v1.0.0</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
