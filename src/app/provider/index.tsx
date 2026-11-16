import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Pressable, RefreshControl, Switch, Text, View } from 'react-native';

import { BookingCard } from '@/components/BookingCard';
import { SendQuoteSheet } from '@/components/BookingSheets';
import { HomeHero } from '@/components/HomeHero';
import { Avatar, Button, Card, EmptyState, Loader, Segmented } from '@/components/ui';
import { bookingAction, PROVIDER_BOOKING_SELECT, stageOf, timeAgo, type BookingRow, type OpenRequest } from '@/lib/booking';
import { formatDateTime, formatPrice } from '@/lib/format';
import { getCurrentLocation, LocationError } from '@/lib/location';
import { supabase } from '@/lib/supabase';
import { colors, shadow } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

type Tab = 'requests' | 'jobs' | 'history';
const POLL_MS = 15_000;

export default function ProviderDashboard() {
  const { session, profile } = useAuth();
  const [online, setOnline] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [requests, setRequests] = useState<OpenRequest[]>([]);
  const [mine, setMine] = useState<BookingRow[]>([]);
  const [tab, setTab] = useState<Tab>('requests');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<number[]>([]);
  const [quoteFor, setQuoteFor] = useState<BookingRow | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const [presence, open, jobs] = await Promise.all([
      supabase.from('provider_presence').select('is_online').eq('user_id', session.user.id).maybeSingle(),
      supabase.rpc('open_requests'),
      supabase.from('bookings').select(PROVIDER_BOOKING_SELECT).eq('provider_id', session.user.id).order('created_at', { ascending: false }).limit(100),
    ]);
    setOnline(!!presence.data?.is_online);
    setRequests((open.data as OpenRequest[]) ?? []);
    setMine((jobs.data as unknown as BookingRow[]) ?? []);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
      const t = setInterval(load, POLL_MS);
      return () => clearInterval(t);
    }, [load]),
  );

  const active = useMemo(() => mine.filter((b) => b.status === 'accepted'), [mine]);
  const history = useMemo(() => mine.filter((b) => b.status !== 'accepted' && b.status !== 'pending'), [mine]);
  const visibleRequests = requests.filter((r) => !skipped.includes(r.id));
  const earned = useMemo(() => history.filter((b) => b.status === 'completed').reduce((s, b) => s + Number(b.total_price), 0), [history]);

  async function toggleOnline(next: boolean) {
    if (!profile?.service_id && next) {
      Alert.alert('Choose your category', 'Pick the service you offer in Profile, then go online.', [
        { text: 'Later', style: 'cancel' },
        { text: 'Open profile', onPress: () => router.navigate('/provider/profile') },
      ]);
      return;
    }
    setSwitching(true);
    try {
      let lat: number | null = null;
      let lng: number | null = null;
      if (next) {
        try {
          const loc = await getCurrentLocation();
          lat = loc.latitude;
          lng = loc.longitude;
        } catch (e) {
          if (e instanceof LocationError && e.openSettings) {
            Alert.alert('Location is off', e.message, [
              { text: 'OK', style: 'cancel' },
              { text: 'Open settings', onPress: () => Linking.openSettings() },
            ]);
          }
          // Still go online; requests without distance will show.
        }
      }
      await bookingAction('set_availability', { p_online: next, p_lat: lat, p_lng: lng });
      setOnline(next);
      await load();
    } catch (e) {
      Alert.alert('Could not change status', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSwitching(false);
    }
  }

  async function run(key: string, fn: string, args: Record<string, unknown>, done?: [string, string]) {
    setBusy(key);
    try {
      await bookingAction(fn, args);
      if (done) Alert.alert(done[0], done[1]);
      return true;
    } catch (e) {
      Alert.alert('Something went wrong', e instanceof Error ? e.message : 'Please try again.');
      return false;
    } finally {
      setBusy(null);
      load();
    }
  }

  async function accept(r: OpenRequest) {
    const ok = await run(`a${r.id}`, 'accept_booking', { p_id: r.id }, [
      'Job accepted',
      `${r.customer_name || 'The customer'} has been told you're coming. Open the job for directions.`,
    ]);
    if (ok) setTab('jobs');
  }

  function release(b: BookingRow) {
    Alert.alert('Hand this job back?', 'It goes back to other nearby workers and the customer is told.', [
      { text: 'Keep job', style: 'cancel' },
      { text: 'Hand back', style: 'destructive', onPress: () => run(`r${b.id}`, 'release_booking', { p_id: b.id }) },
    ]);
  }

  function complete(b: BookingRow) {
    const amount = b.quote_status === 'approved' ? Number(b.total_price) : Number(b.visit_fee);
    const how = b.payment_status === 'held' ? 'will be added to your wallet' : 'should be collected in cash';
    Alert.alert('Mark job completed?', `${formatPrice(amount)} ${how}.`, [
      { text: 'Not yet', style: 'cancel' },
      { text: 'Completed', onPress: () => run(`c${b.id}`, 'complete_booking', { p_id: b.id }, ['Great work!', 'The customer has been asked to rate you.']) },
    ]);
  }

  async function sendQuote(amount: number, note: string) {
    if (!quoteFor) return;
    const ok = await run(`q${quoteFor.id}`, 'send_quote', { p_id: quoteFor.id, p_amount: amount, p_note: note }, [
      'Price sent',
      'The customer will approve it in the app. You can start once they do.',
    ]);
    if (ok) setQuoteFor(null);
  }

  if (loading) return <Loader />;

  const header = (
    <View>
      <HomeHero name={profile?.full_name ?? ''} line1="Ready for" line2="your next" highlight="job?">
        {/* Online switch */}
        <View className="mt-6 flex-row items-center gap-4 rounded-3xl bg-white p-4" style={shadow.md}>
          <View className={`h-12 w-12 items-center justify-center rounded-2xl ${online ? 'bg-emerald-500' : 'bg-slate-200'}`}>
            {switching ? <ActivityIndicator color={colors.white} /> : <Ionicons name={online ? 'radio' : 'moon'} size={24} color={online ? colors.white : colors.muted} />}
          </View>
          <View className="flex-1">
            <Text className="text-base font-bold text-ink">{online ? 'You are online' : 'You are offline'}</Text>
            <Text className="text-[13px] text-slate-500">{online ? 'Nearby requests reach you with sound' : 'Go online to receive requests'}</Text>
          </View>
          <Switch
            value={online}
            onValueChange={toggleOnline}
            disabled={switching}
            trackColor={{ true: colors.brand, false: colors.line }}
            thumbColor={colors.white}
            accessibilityLabel="Online"
          />
        </View>
        <View className="mt-3 flex-row gap-3">
          <Stat icon="star" label="Rating" value={profile?.rating_count ? Number(profile.rating_avg).toFixed(1) : 'New'} />
          <Stat icon="checkmark-done" label="Jobs done" value={String(history.filter((b) => b.status === 'completed').length)} />
          <Stat icon="cash" label="Earned" value={formatPrice(earned)} />
        </View>
      </HomeHero>
      <View className="mt-1 px-5">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'requests', label: 'Requests', count: visibleRequests.length },
            { value: 'jobs', label: 'My jobs', count: active.length },
            { value: 'history', label: 'History' },
          ]}
        />
      </View>
    </View>
  );

  const refresh = (
    <RefreshControl
      refreshing={refreshing}
      tintColor={colors.brand}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    />
  );

  if (tab === 'requests') {
    return (
      <View className="flex-1 bg-surface">
        <FlatList
          data={visibleRequests}
          keyExtractor={(r) => String(r.id)}
          contentContainerClassName="gap-4 pb-10"
          refreshControl={refresh}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <EmptyState
              icon={online ? 'radio-outline' : 'moon-outline'}
              title={online ? 'No requests right now' : "You're offline"}
              subtitle={online ? 'New requests near you appear here with a sound. Keep the app online.' : 'Switch online above to start receiving jobs near you.'}
            />
          }
          renderItem={({ item }) => (
            <View className="px-5">
              <RequestCard r={item} busy={busy === `a${item.id}`} onAccept={() => accept(item)} onSkip={() => setSkipped((s) => [...s, item.id])} />
            </View>
          )}
        />
      </View>
    );
  }

  const list = tab === 'jobs' ? active : history;
  return (
    <View className="flex-1 bg-surface">
      <FlatList
        data={list}
        keyExtractor={(b) => String(b.id)}
        contentContainerClassName="gap-4 pb-10"
        refreshControl={refresh}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            icon={tab === 'jobs' ? 'briefcase-outline' : 'time-outline'}
            title={tab === 'jobs' ? 'No active jobs' : 'No history yet'}
            subtitle={tab === 'jobs' ? 'Accept a request to start.' : 'Completed and cancelled jobs show here.'}
          />
        }
        renderItem={({ item }) => {
          const stage = stageOf(item);
          return (
            <View className="px-5">
              <BookingCard booking={item} viewer="provider">
                {stage === 'assigned' || stage === 'declined' ? (
                  <Button title={stage === 'declined' ? 'Send a new price' : 'Send price'} icon="pricetag-outline" size="md" onPress={() => setQuoteFor(item)} />
                ) : null}
                {stage === 'quote' ? (
                  <View className="flex-row items-center gap-2 rounded-xl bg-violet-50 px-3 py-2.5">
                    <Ionicons name="hourglass-outline" size={16} color="#6D28D9" />
                    <Text className="flex-1 text-[13px] font-medium text-violet-800">
                      Waiting for the customer to approve {formatPrice(item.quote_amount ?? 0)}
                    </Text>
                    <Pressable onPress={() => setQuoteFor(item)} hitSlop={8}>
                      <Text className="text-[13px] font-bold text-violet-700">Change</Text>
                    </Pressable>
                  </View>
                ) : null}
                {stage === 'working' || stage === 'declined' ? (
                  <Button
                    title={stage === 'working' ? 'Mark job completed' : `Complete for visiting fee ${formatPrice(item.visit_fee)}`}
                    icon="checkmark-done"
                    size="md"
                    variant={stage === 'working' ? 'primary' : 'secondary'}
                    loading={busy === `c${item.id}`}
                    onPress={() => complete(item)}
                  />
                ) : null}
                {stage === 'assigned' || stage === 'quote' || stage === 'declined' ? (
                  <Button title="Hand job back" variant="ghost" size="md" loading={busy === `r${item.id}`} onPress={() => release(item)} />
                ) : null}
                {stage === 'completed' && item.rating ? (
                  <View className="flex-row items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Ionicons key={n} name={n <= (item.rating ?? 0) ? 'star' : 'star-outline'} size={15} color={colors.accent} />
                    ))}
                    {item.review ? <Text className="ml-1 flex-1 text-[13px] text-slate-600" numberOfLines={2}>“{item.review}”</Text> : null}
                  </View>
                ) : null}
              </BookingCard>
            </View>
          );
        }}
      />
      {quoteFor ? <SendQuoteSheet key={quoteFor.id} booking={quoteFor} busy={busy === `q${quoteFor.id}`} onClose={() => setQuoteFor(null)} onSend={sendQuote} /> : null}
    </View>
  );
}

function RequestCard({ r, busy, onAccept, onSkip }: { r: OpenRequest; busy: boolean; onAccept: () => void; onSkip: () => void }) {
  return (
    <Card className="p-4">
      <View className="flex-row items-center gap-3">
        <Avatar name={r.customer_name} size={44} uri={r.customer_avatar} />
        <View className="flex-1">
          <Text className="text-[15px] font-bold text-ink">{r.customer_name || 'Customer'}</Text>
          <Text className="text-xs text-slate-500">{timeAgo(r.created_at)} · {r.service_name}</Text>
        </View>
        {r.distance_km != null ? (
          <View className="flex-row items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1">
            <Ionicons name="navigate" size={12} color={colors.brand} />
            <Text className="text-xs font-bold text-brand-800">{r.distance_km} km</Text>
          </View>
        ) : null}
      </View>
      <View className="mt-3 flex-row flex-wrap gap-1.5">
        {r.tasks.map((t) => (
          <View key={t.id} className="rounded-full bg-surface px-2.5 py-1">
            <Text className="text-[12px] font-semibold text-slate-700">{t.name}</Text>
          </View>
        ))}
      </View>
      <View className="mt-3 gap-2">
        <View className="flex-row items-start gap-2">
          <Ionicons name="location-outline" size={16} color={colors.brand} style={{ marginTop: 1 }} />
          <Text className="flex-1 text-[13px] text-slate-600">{r.address}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Ionicons name="calendar-outline" size={16} color={colors.brand} />
          <Text className="flex-1 text-[13px] text-slate-600">
            {new Date(r.scheduled_at).getTime() - new Date(r.created_at).getTime() < 15 * 60_000 ? 'As soon as possible' : formatDateTime(r.scheduled_at)}
          </Text>
          <Text className="text-[13px] font-bold text-ink">Visit {formatPrice(r.visit_fee)}</Text>
        </View>
        {r.notes ? <Text className="text-[13px] italic text-slate-500">“{r.notes}”</Text> : null}
      </View>
      <View className="mt-4 flex-row gap-2">
        <View className="flex-1">
          <Button title="Skip" variant="secondary" size="md" onPress={onSkip} />
        </View>
        <View className="flex-[2]">
          <Button title="Accept job" icon="checkmark-circle" size="md" loading={busy} onPress={onAccept} />
        </View>
      </View>
    </Card>
  );
}

function Stat({ icon, label, value }: { icon: 'star' | 'checkmark-done' | 'cash'; label: string; value: string }) {
  return (
    <View className="flex-1 rounded-3xl bg-white p-3.5" style={shadow.sm}>
      <Ionicons name={icon} size={18} color={icon === 'star' ? colors.accent : colors.brand} />
      <Text className="mt-2 text-lg font-extrabold text-ink" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text className="text-xs font-medium text-slate-500">{label}</Text>
    </View>
  );
}
