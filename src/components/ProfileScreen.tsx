import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { Avatar, Button, Card, Input, ListRow } from '@/components/ui';
import { BIO_MAX_WORDS, countWords, pickAndUploadAvatar, removeAvatarFile } from '@/lib/avatar';
import { supabase } from '@/lib/supabase';
import { colors, shadow } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

export function ProfileScreen() {
  const { session, profile, refreshProfile, signOut } = useAuth();

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  if (!session || !profile) return null;

  const isProvider = profile.role === 'provider';
  const otherRole = isProvider ? 'customer' : 'provider';
  const words = countWords(bio);
  const tooLong = words > BIO_MAX_WORDS;
  const dirty =
    fullName.trim() !== profile.full_name ||
    (phone.trim() || null) !== (profile.phone ?? null) ||
    bio.trim() !== (profile.bio ?? '').trim();

  async function onSave() {
    if (tooLong) {
      Alert.alert('Bio is too long', `Please keep it under ${BIO_MAX_WORDS} words (now ${words}).`);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), phone: phone.trim() || null, bio: bio.trim() })
      .eq('id', profile!.id);
    await refreshProfile();
    setSaving(false);
    if (error) Alert.alert('Could not save', error.message);
    else Alert.alert('Saved', 'Your profile was updated.');
  }

  async function changePhoto() {
    setPhotoBusy(true);
    try {
      const old = profile!.avatar_url;
      const res = await pickAndUploadAvatar(profile!.id);
      if (!res) return; // cancelled
      const { error } = await supabase.from('profiles').update({ avatar_url: res.url }).eq('id', profile!.id);
      if (error) throw error;
      await removeAvatarFile(old);
      await refreshProfile();
    } catch (e) {
      Alert.alert('Could not update photo', (e as Error).message);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    setPhotoBusy(true);
    const old = profile!.avatar_url;
    const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', profile!.id);
    if (!error) await removeAvatarFile(old);
    await refreshProfile();
    setPhotoBusy(false);
    if (error) Alert.alert('Could not remove photo', error.message);
  }

  function photoMenu() {
    if (!profile!.avatar_url) return changePhoto();
    Alert.alert('Profile photo', undefined, [
      { text: 'Choose a new photo', onPress: changePhoto },
      { text: 'Remove photo', style: 'destructive', onPress: removePhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
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
        <View
          className="items-center overflow-hidden px-5 pb-8 pt-4"
          style={{ backgroundImage: `linear-gradient(180deg, ${colors.heroTop} 0%, ${colors.surface} 100%)` }}
        >
          <Pressable
            onPress={photoBusy ? undefined : photoMenu}
            accessibilityRole="button"
            accessibilityLabel={profile.avatar_url ? 'Change profile photo' : 'Add profile photo'}
            className="active:opacity-80"
          >
            <View className="rounded-full bg-white p-1.5" style={shadow.lg}>
              <Avatar name={profile.full_name} size={92} uri={profile.avatar_url} />
              {photoBusy ? (
                <View className="absolute inset-1.5 items-center justify-center rounded-full bg-black/40">
                  <ActivityIndicator color={colors.white} />
                </View>
              ) : null}
            </View>
            <View
              className="absolute bottom-0 right-0 h-9 w-9 items-center justify-center rounded-full border-[3px] border-white bg-brand-700"
              style={shadow.md}
            >
              <Ionicons name="camera" size={16} color={colors.white} />
            </View>
          </Pressable>
          {!profile.avatar_url ? <Text className="mt-2 text-xs font-medium text-brand-700">Tap to add a photo</Text> : null}
          <Text className="mt-4 text-2xl font-extrabold tracking-tight text-ink">{profile.full_name || 'Your name'}</Text>
          <Text className="mt-1 text-[15px] text-slate-500">{session.user.email}</Text>
          <View className="mt-4 flex-row items-center gap-2 rounded-full bg-white px-4 py-1.5" style={shadow.sm}>
            <MaterialCommunityIcons name={isProvider ? 'account-hard-hat' : 'home-heart'} size={15} color={colors.brand} />
            <Text className="text-xs font-bold uppercase tracking-wider text-brand-700">
              {isProvider ? 'Service provider' : 'Customer'}
            </Text>
          </View>
        </View>

        <View className="gap-4 px-5">
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
            <View>
              <Input
                label="Short bio"
                placeholder={
                  isProvider
                    ? 'Your experience, skills and what customers can expect — e.g. “8 years cooking desi & continental food…”'
                    : 'A few words about you (optional)'
                }
                value={bio}
                onChangeText={setBio}
                multiline
                maxLength={5000}
              />
              <View className="mt-1.5 flex-row items-center justify-between">
                <Text className="text-xs text-slate-500">{isProvider ? 'Shown to customers on your service page.' : 'Optional.'}</Text>
                <Text className={`text-xs font-semibold ${tooLong ? 'text-red-600' : words > BIO_MAX_WORDS * 0.9 ? 'text-amber-600' : 'text-slate-400'}`}>
                  {words}/{BIO_MAX_WORDS} words
                </Text>
              </View>
            </View>
            <Button title="Save changes" onPress={onSave} loading={saving} disabled={!dirty || tooLong} />
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
