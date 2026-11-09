import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';

import { EmptyState, Loader, SectionTitle, ServiceIcon } from '@/components/ui';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { colors, shadow } from '@/lib/theme';
import type { Service } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';

type Stats = Record<number, { count: number; from: number }>;

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function CustomerHome() {
  const { profile } = useAuth();

  const [services, setServices] = useState<Service[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [svc, offers] = await Promise.all([
      supabase.from('services').select('*').order('name'),
      supabase.from('provider_services').select('service_id, hourly_rate').eq('is_active', true),
    ]);
    setServices((svc.data as Service[]) ?? []);
    const next: Stats = {};
    for (const o of (offers.data ?? []) as { service_id: number; hourly_rate: number }[]) {
      const rate = Number(o.hourly_rate);
      const cur = next[o.service_id];
      next[o.service_id] = cur ? { count: cur.count + 1, from: Math.min(cur.from, rate) } : { count: 1, from: rate };
    }
    setStats(next);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load]),
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? services.filter((s) => s.name.toLowerCase().includes(q)) : services;
    // Services that have providers first.
    return [...list].sort((a, b) => (stats[b.id]?.count ?? 0) - (stats[a.id]?.count ?? 0));
  }, [services, query, stats]);

  if (loading) return <Loader />;

  const name = profile?.full_name || '';
  const firstName = name.split(' ')[0] || 'there';

  return (
    <View className="flex-1 bg-surface">
      <FlatList
        data={filtered}
        keyExtractor={(s) => String(s.id)}
        numColumns={2}
        columnWrapperClassName="gap-3 px-5"
        contentContainerClassName="gap-3 pb-10"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.brand}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        ListHeaderComponent={
          <View>
            {/* Brand header */}
            <View className="overflow-hidden rounded-b-[32px] bg-brand-900 px-5 pb-16 pt-3">
              <View className="absolute -right-20 -top-16 h-60 w-60 rounded-full bg-white/5" />
              <Text className="text-sm font-medium text-brand-200">
                {greeting()}, <Text className="font-bold text-white">{firstName}</Text>
              </Text>
              <Text className="mt-2 text-[28px] font-bold leading-9 tracking-tight text-white">
                What can we help{'\n'}you with today?
              </Text>
            </View>

            {/* Search — overlaps the header */}
            <View className="-mt-7 px-5">
              <View className="h-14 flex-row items-center gap-3 rounded-2xl bg-white px-4" style={shadow.lg}>
                <Ionicons name="search" size={20} color={colors.brand} />
                <TextInput
                  className="flex-1 text-base text-ink"
                  placeholder="Search cook, electrician, plumber…"
                  placeholderTextColor={colors.subtle}
                  value={query}
                  onChangeText={setQuery}
                  returnKeyType="search"
                />
                {query ? (
                  <Pressable hitSlop={10} onPress={() => setQuery('')} accessibilityLabel="Clear search">
                    <Ionicons name="close-circle" size={20} color={colors.subtle} />
                  </Pressable>
                ) : null}
              </View>
            </View>

            {/* Promo */}
            {!query ? (
              <View className="mx-5 mt-6 flex-row items-center gap-4 rounded-3xl bg-accent-50 p-5">
                <View className="h-12 w-12 items-center justify-center rounded-2xl bg-accent-100">
                  <Ionicons name="time" size={24} color={colors.accentDark} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-bold text-ink">Pay only for the hours you need</Text>
                  <Text className="mt-0.5 text-[13px] leading-5 text-slate-600">
                    Pick 1, 2 or more hours and see the full price before you book.
                  </Text>
                </View>
              </View>
            ) : null}

            <View className="mt-7 px-5">
              <SectionTitle
                title={query ? `Results for “${query}”` : 'All services'}
                subtitle={query ? undefined : 'Tap a service to see available pros'}
              />
            </View>
          </View>
        }
        ListEmptyComponent={<EmptyState icon="search" title="No services found" subtitle="Try another word, like “cook” or “clean”." />}
        renderItem={({ item }) => {
          const s = stats[item.id];
          return (
            <Pressable
              onPress={() => router.push({ pathname: '/service/[id]', params: { id: String(item.id) } })}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}${s ? `, ${s.count} providers` : ''}`}
              className="flex-1 rounded-3xl bg-white p-4"
              style={({ pressed }) => [shadow.md, { maxWidth: '48.4%', transform: [{ scale: pressed ? 0.97 : 1 }] }]}
            >
              <ServiceIcon service={item} tintId={item.id} />
              <Text className="mt-4 text-base font-bold text-ink" numberOfLines={1}>
                {item.name}
              </Text>
              {s ? (
                <>
                  <Text className="mt-1 text-[13px] text-slate-500">
                    {s.count} {s.count === 1 ? 'pro' : 'pros'} available
                  </Text>
                  <Text className="mt-2 text-[13px] font-semibold text-brand-700">
                    from {formatPrice(s.from)}/hr
                  </Text>
                </>
              ) : (
                <>
                  <Text className="mt-1 text-[13px] text-slate-500" numberOfLines={1}>
                    {item.description}
                  </Text>
                  <Text className="mt-2 text-[13px] font-medium text-slate-400">Coming soon</Text>
                </>
              )}
            </Pressable>
          );
        }}
      />
    </View>
  );
}
