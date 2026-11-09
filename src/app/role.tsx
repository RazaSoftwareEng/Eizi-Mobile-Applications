import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Loader } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, shadow } from '@/lib/theme';
import type { Role } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';

const options = [
  {
    role: 'customer',
    icon: 'home-heart',
    title: 'I need a service',
    subtitle: 'Book trusted help for your home',
    points: ['Cooks, cleaners, electricians & more', 'Pay by the hour — see the price first', 'Cancel any time before the job'],
  },
  {
    role: 'provider',
    icon: 'account-hard-hat',
    title: 'I provide a service',
    subtitle: 'Earn with your skills',
    points: ['Set your own hourly price', 'Accept only the jobs you want', 'Get customers near you'],
  },
] as const;

export default function RolePicker() {
  const { session, profile, loading, refreshProfile } = useAuth();
  const [selected, setSelected] = useState<Role | null>(profile?.role ?? null);
  const [saving, setSaving] = useState(false);

  if (loading) return <Loader />;
  if (!session) return <Redirect href="/login" />;

  async function onContinue() {
    if (!selected || !session) return;
    setSaving(true);
    const meta = session.user.user_metadata ?? {};
    const { error } = await supabase.from('profiles').upsert({
      id: session.user.id,
      role: selected,
      full_name: profile?.full_name || meta.full_name || '',
      phone: profile?.phone ?? meta.phone ?? null,
    });
    if (error) {
      setSaving(false);
      Alert.alert('Could not save', error.message);
      return;
    }
    await refreshProfile();
    setSaving(false);
    router.replace('/');
  }

  const firstName = (profile?.full_name || session.user.user_metadata?.full_name || '').split(' ')[0];

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView contentContainerClassName="px-5 pb-6 pt-6">
        <Text className="text-[15px] font-medium text-brand-700">Welcome{firstName ? `, ${firstName}` : ''}</Text>
        <Text className="mt-2 text-[28px] font-bold leading-9 tracking-tight text-ink">How would you like{'\n'}to use Eizi?</Text>
        <Text className="mb-7 mt-2 text-[15px] text-slate-500">You can switch any time from your profile.</Text>

        <View className="gap-4">
          {options.map((o) => {
            const active = selected === o.role;
            return (
              <Pressable
                key={o.role}
                onPress={() => setSelected(o.role)}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                className={`rounded-3xl border-2 bg-white p-5 ${active ? 'border-brand-600' : 'border-transparent'}`}
                style={active ? shadow.lg : shadow.md}
              >
                <View className="flex-row items-center gap-4">
                  <View className={`h-14 w-14 items-center justify-center rounded-2xl ${active ? 'bg-brand-700' : 'bg-brand-50'}`}>
                    <MaterialCommunityIcons name={o.icon} size={28} color={active ? colors.white : colors.brandDark} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-lg font-bold text-ink">{o.title}</Text>
                    <Text className="text-sm text-slate-500">{o.subtitle}</Text>
                  </View>
                  <View
                    className={`h-6 w-6 items-center justify-center rounded-full border-2 ${active ? 'border-brand-600 bg-brand-600' : 'border-slate-300'}`}
                  >
                    {active ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
                  </View>
                </View>

                <View className="mt-4 gap-2 border-t border-slate-100 pt-4">
                  {o.points.map((p) => (
                    <View key={p} className="flex-row items-center gap-2.5">
                      <Ionicons name="checkmark-circle" size={18} color={active ? colors.brand : colors.subtle} />
                      <Text className="text-sm text-slate-600">{p}</Text>
                    </View>
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View className="px-5 pb-4 pt-2">
        <Button title="Continue" icon="arrow-forward" onPress={onContinue} disabled={!selected} loading={saving} />
      </View>
    </SafeAreaView>
  );
}
