import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { StageBadge } from '@/components/BookingCard';
import { FreeMap } from '@/components/FreeMap';
import { greeting } from '@/components/HomeHero';
import { NearbyMapModal } from '@/components/NearbyMapModal';
import { GRID_GAP, GRID_PADDING, HowItWorks, ServiceRow, cardWidthFor, type ServiceStat } from '@/components/ServiceBrowse';
import { EmptyState, Loader, ServiceIcon, serviceGlyph } from '@/components/ui';
import { stageOf, tasksText } from '@/lib/booking';
import { formatPrice } from '@/lib/format';
import { DEFAULT_CENTER, getCurrentLocation, lastKnownLocation, LocationError, type PickedLocation } from '@/lib/location';
import { demoWorkersAround } from '@/lib/nearbyWorkers';
import { supabase } from '@/lib/supabase';
import { colors, shadow, tintFor } from '@/lib/theme';
import type { BookingStatus, QuoteStatus, Service, TaskRef } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';

type Active = {
  id: number;
  service_id: number;
  status: BookingStatus;
  quote_status: QuoteStatus;
  tasks: TaskRef[];
  service: { name: string; icon: string } | null;
};

export default function CustomerHome() {
  const { profile, session } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const tileWidth = cardWidthFor(screenWidth);

  const [services, setServices] = useState<Service[]>([]);
  const [stats, setStats] = useState<Record<number, ServiceStat>>({});
  const [taskNames, setTaskNames] = useState<Record<number, string[]>>({});
  const [active, setActive] = useState<Active | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [here, setHere] = useState<PickedLocation | null>(lastKnownLocation());
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<LocationError | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const workers = useMemo(() => demoWorkersAround(here), [here]);

  const load = useCallback(async () => {
    const [svc, tasks, current] = await Promise.all([
      supabase.from('services').select('*').eq('is_active', true).order('sort').order('name'),
      supabase.from('service_tasks').select('service_id, name').eq('is_active', true),
      session
        ? supabase
            .from('bookings')
            .select('id, service_id, status, quote_status, tasks, service:services(name, icon)')
            .eq('customer_id', session.user.id)
            .in('status', ['pending', 'accepted'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    setServices((svc.data as Service[]) ?? []);
    const s: Record<number, ServiceStat> = {};
    const names: Record<number, string[]> = {};
    for (const t of (tasks.data ?? []) as { service_id: number; name: string }[]) {
      s[t.service_id] = { tasks: (s[t.service_id]?.tasks ?? 0) + 1 };
      (names[t.service_id] ??= []).push(t.name.toLowerCase());
    }
    setStats(s);
    setTaskNames(names);
    setActive((current.data as unknown as Active | null) ?? null);
  }, [session]);

  const locate = useCallback(async (quick: boolean) => {
    setLocating(true);
    try {
      setHere(await getCurrentLocation({ quick }));
      setLocError(null);
    } catch (e) {
      setLocError(e instanceof LocationError ? e : new LocationError('Could not find your location. Check that GPS is on.'));
    } finally {
      setLocating(false);
    }
  }, []);

  // Show where the user is as soon as the home screen opens.
  useEffect(() => {
    if (!lastKnownLocation()) Promise.resolve().then(() => locate(true));
  }, [locate]);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load]),
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return services.filter(
      (s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || (taskNames[s.id] ?? []).some((n) => n.includes(q)),
    );
  }, [services, query, taskNames]);

  function openService(id: number) {
    router.push({ pathname: '/service/[id]', params: { id: String(id) } });
  }

  if (loading) return <Loader />;

  const searching = query.trim().length > 0;
  const activeStage = active ? stageOf(active) : null;
  const firstName = (profile?.full_name ?? '').trim().split(/\s+/)[0] || 'there';

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
            await Promise.all([load(), locate(false)]);
            setRefreshing(false);
          }}
        />
      }
    >
      {/* Greeting */}
      <View className="px-5 pb-3 pt-2" style={{ backgroundImage: `linear-gradient(180deg, ${colors.heroTop} 0%, ${colors.surface} 100%)` }}>
        <Text className="text-[14px] font-medium text-slate-500">{greeting()},</Text>
        <Text className="text-[22px] font-bold tracking-tight text-ink" numberOfLines={1}>
          {firstName}
        </Text>

        {/* Live map with the user's current location */}
        <View className="mt-4 overflow-hidden rounded-3xl bg-white" style={shadow.md}>
          <View>
            <FreeMap
              center={here ?? DEFAULT_CENTER}
              zoom={here ? 14.5 : 11}
              interactive
              mode="explore"
              me={here}
              workers={workers}
              onExpand={() => setMapOpen(true)}
              style={{ height: 230 }}
            />
            {workers.length ? (
              <Pressable
                onPress={() => setMapOpen(true)}
                accessibilityRole="button"
                className="absolute bottom-3 left-3 flex-row items-center gap-1.5 rounded-full bg-white px-3 py-1.5 active:bg-slate-50"
                style={shadow.md}
              >
                <View className="h-2 w-2 rounded-full bg-emerald-500" />
                <Text className="text-[12px] font-bold text-ink">{workers.length} workers nearby</Text>
              </Pressable>
            ) : null}
          </View>
          <View className="flex-row items-center gap-3 px-4 py-3">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-brand-50">
              <Ionicons name="location" size={18} color={colors.brand} />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400">Current location</Text>
              <Text className="text-[14px] font-semibold text-ink" numberOfLines={1}>
                {locating && !here
                  ? 'Finding you…'
                  : here
                    ? here.address || `${here.latitude.toFixed(4)}, ${here.longitude.toFixed(4)}`
                    : locError?.message ?? 'Location unavailable'}
              </Text>
            </View>
            <Pressable
              onPress={() => (locError?.openSettings ? Linking.openSettings() : locate(false))}
              accessibilityRole="button"
              accessibilityLabel="Refresh my location"
              hitSlop={6}
              className="h-10 w-10 items-center justify-center rounded-full border border-line bg-white active:bg-slate-50"
            >
              {locating ? <ActivityIndicator size="small" color={colors.brand} /> : <Ionicons name="locate" size={20} color={colors.brandDark} />}
            </Pressable>
          </View>
        </View>

        {/* Search */}
        <View className="mt-4 h-14 flex-row items-center gap-3 rounded-2xl bg-white px-4" style={shadow.sm}>
          <Ionicons name="search" size={20} color={colors.brand} />
          <TextInput
            className="flex-1 text-base text-ink"
            placeholder="Search fan, ironing, washroom…"
            placeholderTextColor={colors.subtle}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={() => {
              Keyboard.dismiss();
              if (results.length === 1) openService(results[0].id);
            }}
            accessibilityLabel="Search services"
          />
          {query ? (
            <Pressable hitSlop={10} onPress={() => setQuery('')} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={20} color={colors.subtle} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {searching ? (
        <View className="pt-2">
          <Text className="mb-3 px-5 text-sm font-semibold text-slate-500">
            {results.length} result{results.length === 1 ? '' : 's'} for “{query.trim()}”
          </Text>
          {results.length ? (
            results.map((s) => <ServiceRow key={s.id} service={s} stat={stats[s.id]} onPress={() => openService(s.id)} />)
          ) : (
            <EmptyState icon="search" title="No services found" subtitle="Try another word, like “fan”, “ironing” or “washroom”." />
          )}
        </View>
      ) : (
        <>
          {active && activeStage ? (
            <Pressable
              onPress={() => router.navigate('/customer/bookings')}
              className="mx-5 mb-5 mt-2 flex-row items-center gap-3 rounded-3xl bg-white p-4"
              style={shadow.md}
              accessibilityRole="button"
              accessibilityLabel="Open your current request"
            >
              <ServiceIcon service={active.service} tintId={active.service_id} size={48} />
              <View className="flex-1">
                <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {activeStage === 'quote' ? 'Price waiting for you' : 'Your current request'}
                </Text>
                <Text className="mt-0.5 text-base font-bold text-ink" numberOfLines={1}>
                  {active.service?.name}
                </Text>
                <Text className="text-[13px] text-slate-500" numberOfLines={1}>
                  {tasksText(active.tasks, 2)}
                </Text>
              </View>
              <StageBadge stage={activeStage} />
            </Pressable>
          ) : null}

          <View className="mb-3 mt-2 px-5">
            <Text className="text-xl font-bold text-ink">Select a Service</Text>
            <Text className="text-[13px] text-slate-500">Choose a service and book with a few taps.</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: GRID_GAP, rowGap: GRID_GAP, paddingHorizontal: GRID_PADDING }}>
            {services.map((s) => (
              <ServiceTile key={s.id} service={s} tasks={stats[s.id]?.tasks ?? 0} width={tileWidth} onPress={() => openService(s.id)} />
            ))}
            <Pressable
              onPress={() => router.navigate('/customer/bookings')}
              accessibilityRole="button"
              style={[{ width: tileWidth }, shadow.sm]}
              className="items-center justify-center rounded-3xl border border-line bg-white px-3 py-5 active:bg-slate-50"
            >
              <View className="h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                <Ionicons name="calendar-outline" size={30} color={colors.brandDark} />
              </View>
              <Text className="mt-3 text-center text-[15px] font-bold text-ink">My Bookings</Text>
              <Text className="mt-0.5 text-center text-xs text-slate-500">Track requests</Text>
            </Pressable>
          </View>

          <View
            className="mx-5 mb-7 mt-6 flex-row items-center gap-4 overflow-hidden rounded-3xl p-5"
            style={{ backgroundImage: 'linear-gradient(120deg, #0B6358 0%, #14917F 100%)' }}
          >
            <View className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/10" />
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
              <Ionicons name="shield-checkmark" size={24} color={colors.white} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold text-white">You approve the price first</Text>
              <Text className="mt-0.5 text-[13px] leading-5 text-brand-100">
                Workers check the job and send a price. Nothing starts until you say yes.
              </Text>
            </View>
          </View>

          <HowItWorks />
        </>
      )}
      <NearbyMapModal visible={mapOpen} onClose={() => setMapOpen(false)} here={here} workers={workers} />
    </ScrollView>
  );
}

/** Mock-up style tile: illustration (or icon) on a soft tint, name underneath. */
function ServiceTile({ service, tasks, width, onPress }: { service: Service; tasks: number; width: number; onPress: () => void }) {
  const tint = tintFor(service.id);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${service.name}, ${tasks} services, visiting fee ${formatPrice(service.visit_fee)}`}
      style={[{ width }, shadow.sm]}
      className="items-center rounded-3xl border border-line bg-white px-3 py-5 active:border-brand-300 active:bg-brand-50"
    >
      <View className="h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: tint.bg }}>
        {service.image_url ? (
          <Image source={{ uri: service.image_url }} style={{ width: 56, height: 56 }} resizeMode="contain" />
        ) : (
          <MaterialCommunityIcons name={serviceGlyph(service)} size={32} color={tint.fg} />
        )}
      </View>
      <Text className="mt-3 text-center text-[15px] font-bold leading-5 text-ink" numberOfLines={2} maxFontSizeMultiplier={1.3}>
        {service.name}
      </Text>
      <Text className="mt-1 text-center text-xs text-slate-500" numberOfLines={1} maxFontSizeMultiplier={1.2}>
        {tasks ? `${tasks} services · ` : ''}Visit {formatPrice(service.visit_fee)}
      </Text>
    </Pressable>
  );
}
