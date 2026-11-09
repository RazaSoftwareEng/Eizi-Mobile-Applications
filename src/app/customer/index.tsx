import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Keyboard, Pressable, RefreshControl, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { HomeHero } from '@/components/HomeHero';
import { GRID_GAP, GRID_PADDING, HowItWorks, ServiceCard, ServiceRow, cardWidthFor, type ServiceStat } from '@/components/ServiceBrowse';
import { EmptyState, Loader, ServiceIcon, StatusBadge } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { groupServices } from '@/lib/serviceGroups';
import { supabase } from '@/lib/supabase';
import { colors, shadow } from '@/lib/theme';
import type { BookingStatus, Service } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';

type Stats = Record<number, ServiceStat>;
type NextBooking = {
  id: number;
  service_id: number;
  scheduled_at: string;
  hours: number;
  status: BookingStatus;
  service: { name: string; icon: string } | null;
  provider: { full_name: string } | null;
};

export default function CustomerHome() {
  const { profile, session } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = cardWidthFor(screenWidth);

  const [services, setServices] = useState<Service[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [next, setNext] = useState<NextBooking | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [svc, offers, upcoming] = await Promise.all([
      supabase.from('services').select('*').order('name'),
      supabase.from('provider_services').select('service_id, hourly_rate').eq('is_active', true),
      session
        ? supabase
            .from('bookings')
            .select('id, service_id, scheduled_at, hours, status, service:services(name, icon), provider:profiles!bookings_provider_id_fkey(full_name)')
            .eq('customer_id', session.user.id)
            .in('status', ['pending', 'accepted'])
            .gte('scheduled_at', new Date().toISOString())
            .order('scheduled_at')
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    setServices((svc.data as Service[]) ?? []);
    const s: Stats = {};
    for (const o of (offers.data ?? []) as { service_id: number; hourly_rate: number }[]) {
      const rate = Number(o.hourly_rate);
      const cur = s[o.service_id];
      s[o.service_id] = cur ? { count: cur.count + 1, from: Math.min(cur.from, rate) } : { count: 1, from: rate };
    }
    setStats(s);
    setNext((upcoming.data as unknown as NextBooking | null) ?? null);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load]),
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return services
      .filter((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
      .sort((a, b) => (stats[b.id]?.count ?? 0) - (stats[a.id]?.count ?? 0));
  }, [services, query, stats]);

  const groups = useMemo(() => groupServices(services), [services]);

  function openService(id: number) {
    router.push({ pathname: '/service/[id]', params: { id: String(id) } });
  }

  function onSearchSubmit() {
    Keyboard.dismiss();
    if (results.length === 1) openService(results[0].id);
  }

  if (loading) return <Loader />;

  const searching = query.trim().length > 0;

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="pb-12"
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
    >
      <HomeHero name={profile?.full_name ?? ''} line1="What can we help" line2="you with" highlight="today?">
        <View className="mt-6 h-16 flex-row items-center gap-3 rounded-full bg-white pl-5 pr-2" style={shadow.lg}>
          <Ionicons name="search" size={22} color={colors.brand} />
          <TextInput
            className="flex-1 text-base text-ink"
            placeholder="Search cook, electrician, plumber…"
            placeholderTextColor={colors.subtle}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={onSearchSubmit}
            accessibilityLabel="Search services"
          />
          {query ? (
            <Pressable hitSlop={10} onPress={() => setQuery('')} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={20} color={colors.subtle} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={onSearchSubmit}
            accessibilityRole="button"
            accessibilityLabel="Search"
            className="h-12 w-12 items-center justify-center rounded-full bg-brand-700 active:bg-brand-800"
            style={shadow.brand}
          >
            <Ionicons name="arrow-forward" size={22} color={colors.white} />
          </Pressable>
        </View>
      </HomeHero>

      {searching ? (
        /* ---------------- Search results ---------------- */
        <View className="pt-1">
          <Text className="mb-3 px-5 text-sm font-semibold text-slate-500">
            {results.length} result{results.length === 1 ? '' : 's'} for “{query.trim()}”
          </Text>
          {results.length ? (
            results.map((s) => <ServiceRow key={s.id} service={s} stat={stats[s.id]} onPress={() => openService(s.id)} />)
          ) : (
            <EmptyState icon="search" title="No services found" subtitle="Try another word, like “cook”, “clean” or “wiring”." />
          )}
        </View>
      ) : (
        <>
          {/* ---------------- Next booking ---------------- */}
          {next ? (
            <Pressable
              onPress={() => router.navigate('/customer/bookings')}
              className="mx-5 mb-6 flex-row items-center gap-3 rounded-3xl bg-white p-4"
              style={shadow.md}
              accessibilityRole="button"
              accessibilityLabel="Open your next booking"
            >
              <ServiceIcon service={next.service} tintId={next.service_id} size={48} />
              <View className="flex-1">
                <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400">Your next booking</Text>
                <Text className="mt-0.5 text-base font-bold text-ink" numberOfLines={1}>
                  {next.service?.name} · {next.hours} hr{next.hours > 1 ? 's' : ''}
                </Text>
                <Text className="text-[13px] text-slate-500" numberOfLines={1}>
                  {formatDateTime(next.scheduled_at)}
                  {next.provider?.full_name ? ` · ${next.provider.full_name}` : ''}
                </Text>
              </View>
              <StatusBadge status={next.status} />
            </Pressable>
          ) : null}

          {/* ---------------- Services: grouped, illustrated cards ---------------- */}
          {groups.map((g) => (
            <View key={g.title} className="mb-4">
              <SectionHead title={g.title} subtitle={`${g.items.filter((s) => stats[s.id]).length} of ${g.items.length} available now`} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: GRID_GAP, paddingHorizontal: GRID_PADDING }}>
                {[...g.items]
                  .sort((a, b) => (stats[b.id] ? 1 : 0) - (stats[a.id] ? 1 : 0))
                  .map((s) => (
                    <ServiceCard key={s.id} service={s} stat={stats[s.id]} width={cardWidth} onPress={() => openService(s.id)} />
                  ))}
              </View>
            </View>
          ))}

          {/* ---------------- Promo ---------------- */}
          <View
            className="mx-5 mb-7 mt-3 flex-row items-center gap-4 overflow-hidden rounded-3xl p-5"
            style={{ backgroundImage: 'linear-gradient(120deg, #0B6358 0%, #14917F 100%)' }}
          >
            <View className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/10" />
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
              <Ionicons name="time" size={24} color={colors.white} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold text-white">Pay only for the hours you need</Text>
              <Text className="mt-0.5 text-[13px] leading-5 text-brand-100">
                Pick 1, 2 or more hours and see the full price before you book.
              </Text>
            </View>
          </View>

          {/* ---------------- How it works ---------------- */}
          <HowItWorks />
        </>
      )}
    </ScrollView>
  );
}

function SectionHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="mb-3 px-5">
      <Text className="text-lg font-bold text-ink">{title}</Text>
      {subtitle ? <Text className="text-[13px] text-slate-500">{subtitle}</Text> : null}
    </View>
  );
}
