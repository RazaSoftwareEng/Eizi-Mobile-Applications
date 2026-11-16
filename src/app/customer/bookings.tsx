import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import { BookingCard } from '@/components/BookingCard';
import { QuoteSheet, RateSheet } from '@/components/BookingSheets';
import { Button, EmptyState, Loader, ScreenHeader, Segmented } from '@/components/ui';
import { ACTIVE_STAGES, bookingAction, CUSTOMER_BOOKING_SELECT, stageOf, timeAgo, type BookingRow } from '@/lib/booking';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import type { PayMethod } from '@/lib/types';
import { fetchBalance } from '@/lib/wallet';
import { useAuth } from '@/providers/AuthProvider';

type Tab = 'active' | 'past';
const POLL_MS = 15_000;

export default function CustomerBookings() {
  const { session } = useAuth();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [tab, setTab] = useState<Tab>('active');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [quoteFor, setQuoteFor] = useState<BookingRow | null>(null);
  const [rateFor, setRateFor] = useState<BookingRow | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const shownQuotes = useRef(new Set<string>()); // pop each new price up once

  const load = useCallback(async () => {
    if (!session) return;
    const { data, error } = await supabase
      .from('bookings')
      .select(CUSTOMER_BOOKING_SELECT)
      .eq('customer_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return;
    const rows = (data as unknown as BookingRow[]) ?? [];
    setBookings(rows);

    // A new price arrived → open the approval pop-up automatically.
    const waiting = rows.find((b) => stageOf(b) === 'quote' && !shownQuotes.current.has(`${b.id}:${b.quote_amount}`));
    if (waiting) {
      shownQuotes.current.add(`${waiting.id}:${waiting.quote_amount}`);
      fetchBalance(session.user.id).then(setBalance);
      setQuoteFor((cur) => cur ?? waiting);
    }
  }, [session]);

  // Refresh while the screen is open so worker updates show up without pulling.
  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
      const t = setInterval(load, POLL_MS);
      return () => clearInterval(t);
    }, [load]),
  );

  const active = useMemo(() => bookings.filter((b) => ACTIVE_STAGES.includes(stageOf(b))), [bookings]);
  const past = useMemo(() => bookings.filter((b) => !ACTIVE_STAGES.includes(stageOf(b))), [bookings]);
  const visible = tab === 'active' ? active : past;

  async function run(id: number, fn: string, args: Record<string, unknown>, done?: string) {
    setBusy(id);
    try {
      await bookingAction(fn, args);
      if (done) Alert.alert(done.split('|')[0], done.split('|')[1]);
      return true;
    } catch (e) {
      Alert.alert('Something went wrong', e instanceof Error ? e.message : 'Please try again.');
      return false;
    } finally {
      setBusy(null);
      load();
    }
  }

  function confirmCancel(b: BookingRow) {
    const stage = stageOf(b);
    Alert.alert(
      'Cancel this request?',
      stage === 'searching' ? 'Workers nearby will stop seeing it.' : 'Your worker will be told that you cancelled.',
      [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Yes, cancel', style: 'destructive', onPress: () => run(b.id, 'cancel_booking', { p_id: b.id }) },
      ],
    );
  }

  async function respond(approve: boolean, pay: PayMethod) {
    if (!quoteFor) return;
    const b = quoteFor;
    const ok = await run(
      b.id,
      'respond_quote',
      { p_id: b.id, p_approve: approve, p_pay: pay },
      approve
        ? `Price approved|${b.person?.full_name ?? 'Your worker'} can start now.${pay === 'wallet' ? ` ${formatPrice(b.quote_amount ?? 0)} is held safely until the job is done.` : ' Pay in cash when it is done.'}`
        : `Price declined|Your worker can send a new price. If they leave, only the visiting fee ${formatPrice(b.visit_fee)} applies.`,
    );
    if (ok) setQuoteFor(null);
  }

  async function rate(stars: number, review: string) {
    if (!rateFor) return;
    const ok = await run(rateFor.id, 'rate_booking', { p_id: rateFor.id, p_stars: stars, p_review: review }, 'Thank you!|Your rating was saved.');
    if (ok) setRateFor(null);
  }

  function openQuote(b: BookingRow) {
    if (session) fetchBalance(session.user.id).then(setBalance);
    setQuoteFor(b);
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
            <ScreenHeader title="My bookings" subtitle="Track your requests live" />
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
            <EmptyState icon="calendar-outline" title="No active requests" subtitle="Pick a service and nearby workers will get your request.">
              <Button title="Browse services" icon="grid-outline" onPress={() => router.navigate('/customer')} />
            </EmptyState>
          ) : (
            <EmptyState icon="time-outline" title="No past bookings" subtitle="Completed and cancelled bookings will show here." />
          )
        }
        renderItem={({ item }) => {
          const stage = stageOf(item);
          const canCancel = stage === 'searching' || stage === 'assigned' || stage === 'quote' || stage === 'declined';
          return (
            <BookingCard
              booking={item}
              viewer="customer"
              banner={
                stage === 'searching' ? (
                  <Banner icon="radio-outline" tone="amber" text={`Sent ${timeAgo(item.created_at)} to nearby workers. We'll notify you when one accepts.`} />
                ) : stage === 'quote' ? (
                  <Banner icon="pricetag" tone="violet" text={`Price ${formatPrice(item.quote_amount ?? 0)} is waiting for your approval.`} onPress={() => openQuote(item)} />
                ) : stage === 'assigned' ? (
                  <Banner icon="walk" tone="sky" text="Your worker is on the way. They'll check the job and send you a price." />
                ) : null
              }
            >
              {stage === 'quote' ? <Button title={`Review price ${formatPrice(item.quote_amount ?? 0)}`} icon="pricetag-outline" size="md" onPress={() => openQuote(item)} /> : null}
              {stage === 'completed' && item.provider_id && item.rating == null ? (
                <Button title="Rate your worker" icon="star-outline" size="md" onPress={() => setRateFor(item)} />
              ) : null}
              {stage === 'completed' && item.rating ? (
                <View className="flex-row items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Ionicons key={n} name={n <= (item.rating ?? 0) ? 'star' : 'star-outline'} size={16} color={colors.accent} />
                  ))}
                  <Text className="ml-1 text-[13px] text-slate-500">You rated this job</Text>
                </View>
              ) : null}
              {canCancel ? (
                <Button
                  title={stage === 'searching' ? 'Cancel request' : 'Cancel booking'}
                  variant="danger"
                  size="md"
                  icon="close-circle-outline"
                  loading={busy === item.id}
                  onPress={() => confirmCancel(item)}
                />
              ) : null}
            </BookingCard>
          );
        }}
      />

      {quoteFor ? (
        <QuoteSheet
          key={quoteFor.id}
          booking={quoteFor}
          balance={balance}
          busy={busy === quoteFor.id}
          onClose={() => setQuoteFor(null)}
          onRespond={respond}
          onAddMoney={() => {
            setQuoteFor(null);
            router.push('/wallet/add');
          }}
        />
      ) : null}
      {rateFor ? <RateSheet key={rateFor.id} booking={rateFor} busy={busy === rateFor.id} onClose={() => setRateFor(null)} onRate={rate} /> : null}
    </View>
  );
}

const TONES = {
  amber: { box: 'bg-amber-50', text: 'text-amber-800', fg: '#B45309' },
  violet: { box: 'bg-violet-50', text: 'text-violet-800', fg: '#6D28D9' },
  sky: { box: 'bg-sky-50', text: 'text-sky-800', fg: '#0369A1' },
};

function Banner({ icon, tone, text, onPress }: { icon: 'radio-outline' | 'pricetag' | 'walk'; tone: keyof typeof TONES; text: string; onPress?: () => void }) {
  const t = TONES[tone];
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className={`mt-3 flex-row items-center gap-2 rounded-xl px-3 py-2.5 ${t.box} active:opacity-80`}
    >
      <Ionicons name={icon} size={17} color={t.fg} />
      <Text className={`flex-1 text-[13px] font-medium ${t.text}`}>{text}</Text>
      {onPress ? <Ionicons name="chevron-forward" size={16} color={t.fg} /> : null}
    </Pressable>
  );
}
