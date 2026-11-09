import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, Text, View } from 'react-native';

import { BOOKING_SELECT, BookingCard, type BookingRow } from '@/components/BookingCard';
import { Button, EmptyState, Loader, Segmented, type IconName } from '@/components/ui';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import type { BookingStatus } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';

type Filter = 'new' | 'upcoming' | 'history';
const FILTERS: Record<Filter, BookingStatus[]> = {
  new: ['pending'],
  upcoming: ['accepted'],
  history: ['completed', 'rejected', 'cancelled'],
};

export default function ProviderRequests() {
  const { session, profile } = useAuth();

  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [filter, setFilter] = useState<Filter>('new');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const { data, error } = await supabase
      .from('bookings')
      .select(`${BOOKING_SELECT}, person:profiles!bookings_customer_id_fkey(full_name, phone)`)
      .eq('provider_id', session.user.id)
      .order('scheduled_at', { ascending: true });
    if (error) Alert.alert('Could not load requests', error.message);
    setBookings((data as unknown as BookingRow[]) ?? []);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load]),
  );

  const counts = useMemo(() => {
    const c = { new: 0, upcoming: 0, history: 0 };
    for (const b of bookings) {
      for (const k of Object.keys(FILTERS) as Filter[]) if (FILTERS[k].includes(b.status)) c[k]++;
    }
    return c;
  }, [bookings]);

  const earned = useMemo(
    () => bookings.filter((b) => b.status === 'completed').reduce((sum, b) => sum + Number(b.total_price), 0),
    [bookings],
  );

  const visible = useMemo(() => {
    const list = bookings.filter((b) => FILTERS[filter].includes(b.status));
    return filter === 'history' ? [...list].reverse() : list;
  }, [bookings, filter]);

  async function setStatus(id: number, status: BookingStatus) {
    setBusy(`${id}:${status}`);
    const { error } = await supabase.from('bookings').update({ status }).eq('id', id);
    setBusy(null);
    if (error) Alert.alert('Could not update', error.message);
    await load();
  }

  function confirmReject(id: number) {
    Alert.alert('Decline this request?', 'The customer will see that you declined.', [
      { text: 'Back', style: 'cancel' },
      { text: 'Decline', style: 'destructive', onPress: () => setStatus(id, 'rejected') },
    ]);
  }

  if (loading) return <Loader />;

  const name = profile?.full_name || '';

  return (
    <View className="flex-1 bg-surface">
      <FlatList
        data={visible}
        keyExtractor={(b) => String(b.id)}
        contentContainerClassName="gap-4 pb-10"
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
            {/* Dashboard header */}
            <View className="overflow-hidden rounded-b-[32px] bg-brand-900 px-5 pb-6 pt-3">
              <View className="absolute -right-20 -top-16 h-60 w-60 rounded-full bg-white/5" />
              <Text className="text-sm font-medium text-brand-200">Provider dashboard</Text>
              <Text className="mt-0.5 text-2xl font-bold text-white">Hi, {name.split(' ')[0] || 'there'}</Text>

              <View className="mt-5 flex-row gap-3">
                <Stat icon="notifications" label="New" value={String(counts.new)} />
                <Stat icon="calendar" label="Upcoming" value={String(counts.upcoming)} />
                <Stat icon="wallet" label="Earned" value={formatPrice(earned)} wide />
              </View>
            </View>

            <View className="mt-5 px-5">
              <Segmented<Filter>
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'new', label: 'New', count: counts.new },
                  { value: 'upcoming', label: 'Upcoming', count: counts.upcoming },
                  { value: 'history', label: 'History' },
                ]}
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon={filter === 'new' ? 'notifications-off-outline' : 'calendar-clear-outline'}
            title={filter === 'new' ? 'No new requests' : filter === 'upcoming' ? 'No upcoming jobs' : 'No history yet'}
            subtitle={
              filter === 'new'
                ? 'Keep your services and hourly prices up to date so customers can find you.'
                : 'Jobs will appear here as you accept and complete them.'
            }
          >
            {filter === 'new' ? (
              <Button title="Manage my services" variant="secondary" icon="briefcase-outline" onPress={() => router.navigate('/provider/services')} />
            ) : null}
          </EmptyState>
        }
        renderItem={({ item }) => (
          <View className="px-5">
            <BookingCard
              booking={item}
              personLabel="Customer"
              showPhone={item.status === 'pending' || item.status === 'accepted'}
              actions={
                item.status === 'pending' ? (
                  <>
                    <View className="flex-1">
                      <Button
                        title="Decline"
                        variant="secondary"
                        size="md"
                        loading={busy === `${item.id}:rejected`}
                        onPress={() => confirmReject(item.id)}
                      />
                    </View>
                    <View className="flex-1">
                      <Button
                        title="Accept"
                        size="md"
                        icon="checkmark"
                        loading={busy === `${item.id}:accepted`}
                        onPress={() => setStatus(item.id, 'accepted')}
                      />
                    </View>
                  </>
                ) : item.status === 'accepted' ? (
                  <View className="flex-1">
                    <Button
                      title="Mark job as completed"
                      icon="checkmark-done"
                      size="md"
                      loading={busy === `${item.id}:completed`}
                      onPress={() => setStatus(item.id, 'completed')}
                    />
                  </View>
                ) : null
              }
            />
          </View>
        )}
      />
    </View>
  );
}

function Stat({ icon, label, value, wide }: { icon: IconName; label: string; value: string; wide?: boolean }) {
  return (
    <View className={`rounded-2xl bg-white/10 p-3.5 ${wide ? 'flex-[1.6]' : 'flex-1'}`}>
      <View className="flex-row items-center gap-1.5">
        <Ionicons name={icon} size={14} color={colors.white} />
        <Text className="text-xs font-medium text-brand-100">{label}</Text>
      </View>
      <Text className="mt-1.5 text-xl font-bold text-white" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}
