import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, EmptyState, Loader, serviceGlyph } from '@/components/ui';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { colors, shadow, tintFor } from '@/lib/theme';
import type { Service, ServiceTask } from '@/lib/types';

/** Step 1 of a request: tick the exact jobs needed inside this category. */
export default function PickTasks() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [service, setService] = useState<Service | null>(null);
  const [tasks, setTasks] = useState<ServiceTask[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [svc, list] = await Promise.all([
        supabase.from('services').select('*').eq('id', id).maybeSingle(),
        supabase.from('service_tasks').select('*').eq('service_id', id).eq('is_active', true).order('sort').order('id'),
      ]);
      setService(svc.data as Service | null);
      setTasks((list.data as ServiceTask[]) ?? []);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <Loader />;
  if (!service || !service.is_active) {
    return (
      <EmptyState icon="alert-circle-outline" title="Service unavailable" subtitle="This category isn't taking requests right now.">
        <Button title="Go back" variant="secondary" onPress={() => router.back()} />
      </EmptyState>
    );
  }

  const tint = tintFor(service.id);
  const toggle = (taskId: number) => setPicked((p) => (p.includes(taskId) ? p.filter((x) => x !== taskId) : [...p, taskId]));

  function proceed() {
    router.push({ pathname: '/book/[id]', params: { id: String(service!.id), tasks: picked.join(',') } });
  }

  return (
    <View className="flex-1 bg-surface">
      <Stack.Screen options={{ title: service.name }} />
      <ScrollView contentContainerClassName="px-5 pb-8 pt-1" showsVerticalScrollIndicator={false}>
        {/* Category header */}
        <View className="mb-5 flex-row items-center gap-4 rounded-3xl bg-white p-4" style={shadow.md}>
          <View className="h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: tint.bg }}>
            {service.image_url ? (
              <Image source={{ uri: service.image_url }} style={{ width: 56, height: 56 }} resizeMode="contain" />
            ) : (
              <MaterialCommunityIcons name={serviceGlyph(service)} size={32} color={tint.fg} />
            )}
          </View>
          <View className="flex-1">
            <Text className="text-lg font-bold text-ink">{service.name}</Text>
            <Text className="text-[13px] leading-5 text-slate-500">{service.description}</Text>
          </View>
        </View>

        <Text className="mb-1 text-base font-bold text-ink">What do you need?</Text>
        <Text className="mb-3 text-[13px] text-slate-500">Tick one or more. The worker confirms the final price after checking.</Text>

        {tasks.length === 0 ? (
          <EmptyState icon="construct-outline" title="No jobs listed yet" subtitle="Please check back soon." />
        ) : (
          <View className="gap-3">
            {tasks.map((t) => {
              const on = picked.includes(t.id);
              return (
                <Pressable
                  key={t.id}
                  onPress={() => toggle(t.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  className={`flex-row items-center gap-3 rounded-2xl border-2 bg-white p-4 ${on ? 'border-brand-600' : 'border-transparent'}`}
                  style={on ? shadow.md : shadow.sm}
                >
                  <View className={`h-6 w-6 items-center justify-center rounded-md border-2 ${on ? 'border-brand-700 bg-brand-700' : 'border-slate-300 bg-white'}`}>
                    {on ? <Ionicons name="checkmark" size={16} color={colors.white} /> : null}
                  </View>
                  <View className="flex-1">
                    <Text className="text-[15px] font-semibold text-ink">{t.name}</Text>
                    {t.base_price != null ? (
                      <Text className="mt-0.5 text-xs text-slate-500">Usually from {formatPrice(t.base_price)}</Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Sticky bar: selection + visiting fee */}
      <View className="gap-3 rounded-t-3xl bg-white px-5 pt-4" style={[shadow.top, { paddingBottom: insets.bottom + 12 }]}>
        <View className="flex-row items-center gap-2 rounded-2xl bg-brand-50 px-3 py-2.5">
          <Ionicons name="home-outline" size={18} color={colors.brand} />
          <Text className="flex-1 text-[13px] text-brand-800">
            <Text className="font-bold">{picked.length} selected</Text> · Base visiting fee{' '}
            <Text className="font-bold">{formatPrice(service.visit_fee)}</Text> (adjusted in the final price)
          </Text>
        </View>
        <Button
          title={picked.length ? 'Proceed & set location' : 'Select at least one job'}
          icon="arrow-forward"
          onPress={proceed}
          disabled={!picked.length}
        />
      </View>
    </View>
  );
}
