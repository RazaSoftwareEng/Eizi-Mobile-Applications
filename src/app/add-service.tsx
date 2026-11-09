import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Input, Loader, PriceRow, ServiceIcon } from '@/components/ui';
import { suggestedDescriptions } from '@/lib/serviceDescriptions';
import { supabase } from '@/lib/supabase';
import { colors, shadow } from '@/lib/theme';
import type { Service } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';

/** Add a new service, or edit one when opened with ?serviceId=… */
export default function AddService() {
  const { serviceId } = useLocalSearchParams<{ serviceId?: string }>();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const [services, setServices] = useState<Service[]>([]);
  const [taken, setTaken] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<number | null>(serviceId ? Number(serviceId) : null);
  const [rate, setRate] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const editing = Boolean(serviceId);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const [all, mine] = await Promise.all([
        supabase.from('services').select('*').order('name'),
        supabase
          .from('provider_services')
          .select('service_id, hourly_rate, description')
          .eq('provider_id', session.user.id),
      ]);
      setServices((all.data as Service[]) ?? []);
      const rows = (mine.data ?? []) as { service_id: number; hourly_rate: number; description: string }[];
      setTaken(new Set(rows.map((r) => r.service_id)));
      if (serviceId) {
        const existing = rows.find((r) => r.service_id === Number(serviceId));
        if (existing) {
          setRate(String(Number(existing.hourly_rate)));
          setDescription(existing.description);
        }
      }
      setLoading(false);
    })();
  }, [session, serviceId]);

  async function onSave() {
    if (!session) return;
    const value = Number(rate);
    if (!selected) {
      Alert.alert('Pick a service', 'Choose which service you offer.');
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      Alert.alert('Hourly price', 'Enter a valid price per hour, e.g. 500.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('provider_services').upsert(
      {
        provider_id: session.user.id,
        service_id: selected,
        hourly_rate: value,
        description: description.trim(),
        is_active: true,
      },
      { onConflict: 'provider_id,service_id' },
    );
    setSaving(false);
    if (error) {
      Alert.alert('Could not save', error.message);
      return;
    }
    router.back();
  }

  if (loading) return <Loader />;

  const selectedService = services.find((s) => s.id === selected) ?? null;
  const choices = editing ? services.filter((s) => s.id === selected) : services.filter((s) => !taken.has(s.id));
  const preview = Number(rate) > 0 ? Number(rate) : 0;

  return (
    <KeyboardAvoidingView className="flex-1 bg-surface" behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={60}>
      <ScrollView contentContainerClassName="gap-4 px-5 pb-6 pt-2" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Card className="p-5">
          <Text className="text-base font-bold text-ink">{editing ? 'Service' : 'What service do you offer?'}</Text>
          {!editing ? <Text className="mb-4 mt-1 text-[13px] text-slate-500">Choose one — you can add more later.</Text> : <View className="mb-4" />}

          {choices.length === 0 ? (
            <Text className="text-slate-500">You have added every service. Edit one from your list instead.</Text>
          ) : (
            <View className="flex-row flex-wrap gap-2.5">
              {choices.map((s) => {
                const active = selected === s.id;
                return (
                  <Pressable
                    key={s.id}
                    disabled={editing}
                    onPress={() => setSelected(s.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    className={`items-center rounded-2xl border-2 px-2 py-3 ${active ? 'border-brand-600 bg-brand-50' : 'border-transparent bg-surface'}`}
                    style={{ width: '31.4%' }}
                  >
                    {active ? (
                      <View className="absolute right-1.5 top-1.5">
                        <Ionicons name="checkmark-circle" size={18} color={colors.brand} />
                      </View>
                    ) : null}
                    <ServiceIcon service={s} tintId={s.id} size={44} onColor={active} />
                    <Text className={`mt-2 text-center text-xs font-semibold ${active ? 'text-brand-800' : 'text-slate-700'}`} numberOfLines={1}>
                      {s.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Card>

        <Card className="gap-4 p-5">
          <Input
            label="Your price per hour"
            prefix="Rs"
            suffix="/ hour"
            placeholder="500"
            keyboardType="number-pad"
            value={rate}
            onChangeText={(t) => setRate(t.replace(/[^0-9.]/g, ''))}
            hint="Tip: check what others charge for this service and price fairly."
          />

          {preview > 0 ? (
            <View className="rounded-2xl bg-surface p-4">
              <Text className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-slate-500">Customers will pay</Text>
              <PriceRow label="1 hour" value={preview} />
              <PriceRow label="2 hours" value={preview * 2} />
              <PriceRow label="4 hours" value={preview * 4} />
            </View>
          ) : null}

          <Input
            label="About your work (optional)"
            placeholder="Your experience, what's included, tools you bring…"
            value={description}
            onChangeText={setDescription}
            multiline
          />

          {/* One-tap ready-made descriptions for the chosen service */}
          {selectedService ? (
            <View>
              <View className="mb-2 flex-row items-center gap-1.5">
                <Ionicons name="sparkles" size={14} color={colors.accentDark} />
                <Text className="text-[13px] font-bold text-ink">Suggested for {selectedService.name}</Text>
              </View>
              <Text className="mb-3 text-xs text-slate-500">Tap one to use it — you can still edit it above.</Text>
              <View className="gap-2">
                {suggestedDescriptions(selectedService.name).map((text) => {
                  const used = description.trim() === text;
                  return (
                    <Pressable
                      key={text}
                      onPress={() => setDescription(text)}
                      accessibilityRole="button"
                      accessibilityLabel={`Use description: ${text}`}
                      className={`flex-row items-start gap-3 rounded-2xl border p-3 active:opacity-80 ${used ? 'border-brand-600 bg-brand-50' : 'border-line bg-surface'}`}
                    >
                      <Text className="flex-1 text-[13px] leading-5 text-slate-700">{text}</Text>
                      <View className={`mt-0.5 rounded-full px-2 py-0.5 ${used ? 'bg-brand-700' : 'bg-white'}`}>
                        <Text className={`text-[11px] font-bold ${used ? 'text-white' : 'text-brand-700'}`}>{used ? 'Added' : 'Use'}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </Card>
      </ScrollView>

      <View className="rounded-t-3xl bg-white px-5 pt-4" style={[shadow.top, { paddingBottom: insets.bottom + 12 }]}>
        <Button
          title={editing ? 'Save changes' : 'Add service'}
          icon={editing ? 'checkmark' : 'add'}
          onPress={onSave}
          loading={saving}
          disabled={!selected || !(Number(rate) > 0)}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
