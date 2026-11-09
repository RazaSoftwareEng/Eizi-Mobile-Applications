import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, View } from 'react-native';

import { BOOKING_SELECT, BookingCard, type BookingRow } from '@/components/BookingCard';
import { Button, EmptyState, Loader, ScreenHeader, Segmented } from '@/components/ui';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

type Tab = 'active' | 'past';
const isActive = (b: BookingRow) => b.status === 'pending' || b.status === 'accepted';

export default function CustomerBookings() {
  const { session } = useAuth();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [tab, setTab] = useState<Tab>('active');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const { data, error } = await supabase
      .from('bookings')
      .select(`${BOOKING_SELECT}, person:profiles!bookings_provider_id_fkey(full_name, phone, avatar_url)`)
      .eq('customer_id', session.user.id)
      .order('scheduled_at', { ascending: false });
    if (error) Alert.alert('Could not load bookings', error.message);
    setBookings((data as unknown as BookingRow[]) ?? []);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load]),
  );

  const active = useMemo(() => bookings.filter(isActive).reverse(), [bookings]); // soonest first
  const past = useMemo(() => bookings.filter((b) => !isActive(b)), [bookings]); // latest first
  const visible = tab === 'active' ? active : past;

  function confirmCancel(id: number) {
    const b = bookings.find((x) => x.id === id);
    const refund = b?.payment_status === 'held' ? `\n\n${formatPrice(b.total_price)} will be refunded to your wallet right away.` : '';
    Alert.alert('Cancel this booking?', `The provider will see that you cancelled.${refund}`, [
      { text: 'Keep booking', style: 'cancel' },
      {
        text: 'Yes, cancel',
        style: 'destructive',
        onPress: async () => {
          setBusyId(id);
          const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
          setBusyId(null);
          if (error) Alert.alert('Could not cancel', error.message);
          await load();
        },
      },
    ]);
  }

  if (loading) return <Loader />;

  return (
    <View className="flex-1 bg-surface">
      <FlatList
        data={visible}
        keyExtractor={(b) => String(b.id)}
        contentContainerClassName="gap-4 px-5 pb-10"
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
          <View className="-mx-5 mb-1">
            <ScreenHeader title="My bookings" subtitle="Track and manage your requests" />
            <View className="px-5">
              <Segmented<Tab>
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'active', label: 'Active', count: active.length },
                  { value: 'past', label: 'Past', count: past.length },
                ]}
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          tab === 'active' ? (
            <EmptyState icon="calendar-outline" title="No active bookings" subtitle="Book a trusted pro in just a few taps.">
              <Button title="Browse services" icon="grid-outline" onPress={() => router.navigate('/customer')} />
            </EmptyState>
          ) : (
            <EmptyState icon="time-outline" title="No past bookings" subtitle="Completed and cancelled bookings will show here." />
          )
        }
        renderItem={({ item }) => (
          <BookingCard
            booking={item}
            personLabel="Your provider"
            showPhone={item.status === 'accepted'}
            actions={
              isActive(item) ? (
                <View className="flex-1">
                  <Button
                    title="Cancel booking"
                    variant="danger"
                    size="md"
                    icon="close-circle-outline"
                    loading={busyId === item.id}
                    onPress={() => confirmCancel(item.id)}
                  />
                </View>
              ) : null
            }
          />
        )}
      />
    </View>
  );
}
