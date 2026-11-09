import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Button, Card, Chip, EmptyState, Input, Loader, PriceRow, serviceGlyph } from '@/components/ui';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { colors, shadow } from '@/lib/theme';
import { fetchBalance } from '@/lib/wallet';
import { useAuth } from '@/providers/AuthProvider';

type Offer = {
  id: number;
  hourly_rate: number;
  description: string;
  service: { name: string; icon: string } | null;
  provider: { full_name: string; avatar_url: string | null } | null;
};

const QUICK_HOURS = [1, 2, 3, 4];
const MAX_HOURS = 12;
const FIRST_SLOT = 8; // 8 AM
const LAST_SLOT = 20; // 8 PM

function nextDays(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function hourLabel(h: number) {
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 === 0 ? 12 : h % 12}:00 ${suffix}`;
}

export default function BookService() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);

  const [hours, setHours] = useState(2);
  const days = useMemo(() => nextDays(7), []);
  const [dayIndex, setDayIndex] = useState(0);
  const [slot, setSlot] = useState<number | null>(null);
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [payWith, setPayWith] = useState<'cash' | 'wallet'>('cash');
  const [balance, setBalance] = useState<number | null>(null);

  // Wallet balance — refreshed whenever the screen is focused (e.g. after adding money).
  useFocusEffect(
    useCallback(() => {
      if (session) fetchBalance(session.user.id).then(setBalance);
    }, [session]),
  );

  useEffect(() => {
    supabase
      .from('provider_services')
      .select('id, hourly_rate, description, service:services(name, icon), provider:profiles(full_name, avatar_url)')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }) => {
        setOffer(data as unknown as Offer | null);
        setLoading(false);
      });
  }, [id]);

  // For today, only show slots at least one hour from now.
  const slots = useMemo(() => {
    const all = Array.from({ length: LAST_SLOT - FIRST_SLOT + 1 }, (_, i) => FIRST_SLOT + i);
    if (dayIndex !== 0) return all;
    const nowHour = new Date().getHours();
    return all.filter((h) => h > nowHour);
  }, [dayIndex]);

  // A slot chosen on another day may not exist for the newly picked day.
  const activeSlot = slot !== null && slots.includes(slot) ? slot : null;

  if (loading) return <Loader />;
  if (!offer) {
    return (
      <EmptyState icon="alert-circle-outline" title="Service unavailable" subtitle="This provider is no longer offering it.">
        <Button title="Go back" variant="secondary" onPress={() => router.back()} />
      </EmptyState>
    );
  }

  const rate = Number(offer.hourly_rate);
  const total = rate * hours;
  const walletShort = balance !== null && balance < total;
  const paying = payWith === 'wallet' && walletShort ? 'cash' : payWith; // never submit a wallet payment we know will fail
  const ready = activeSlot !== null && address.trim().length > 0;

  async function onBook() {
    if (!session || !offer) return;
    if (activeSlot === null) {
      Alert.alert('Pick a time', 'Please choose a start time for the service.');
      return;
    }
    if (!address.trim()) {
      Alert.alert('Address required', 'Please enter where the service is needed.');
      return;
    }
    const when = new Date(days[dayIndex]);
    when.setHours(activeSlot, 0, 0, 0);

    setSubmitting(true);
    // provider_id / rate / total are filled in by the database trigger from provider_services.
    const { error } = await supabase.from('bookings').insert({
      customer_id: session.user.id,
      provider_service_id: offer.id,
      hours,
      scheduled_at: when.toISOString(),
      address: address.trim(),
      notes: notes.trim(),
      payment_method: paying,
    });
    setSubmitting(false);

    if (error) {
      Alert.alert('Booking failed', error.message);
      return;
    }
    Alert.alert(
      'Booking sent',
      `${offer.provider?.full_name || 'The provider'} will confirm your request shortly.` +
        (paying === 'wallet' ? `\n\n${formatPrice(total)} was paid from your wallet and is held until the job is done. If it's cancelled or declined, you get it back.` : ''),
    );
    router.dismissAll();
    router.replace('/customer/bookings');
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView contentContainerClassName="gap-4 px-5 pb-8 pt-1" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Provider summary */}
        <Card className="flex-row items-center gap-3 p-4">
          <Avatar name={offer.provider?.full_name ?? ''} size={52} uri={offer.provider?.avatar_url} />
          <View className="flex-1">
            <Text className="text-base font-bold text-ink" numberOfLines={1}>
              {offer.provider?.full_name || 'Provider'}
            </Text>
            <View className="mt-0.5 flex-row items-center gap-1.5">
              <MaterialCommunityIcons name={serviceGlyph(offer.service)} size={14} color={colors.muted} />
              <Text className="text-[13px] text-slate-500">{offer.service?.name}</Text>
            </View>
          </View>
          <View className="items-end">
            <Text className="text-lg font-bold text-brand-700">{formatPrice(rate)}</Text>
            <Text className="text-[11px] font-medium text-slate-500">per hour</Text>
          </View>
        </Card>

        {/* 1. Duration */}
        <Step n={1} title="How many hours?">
          <View className="flex-row gap-2">
            {QUICK_HOURS.map((h) => (
              <View key={h} className="flex-1">
                <Chip label={`${h} hr`} sublabel={formatPrice(rate * h)} selected={hours === h} onPress={() => setHours(h)} />
              </View>
            ))}
          </View>
          <View className="mt-3 flex-row items-center justify-between rounded-2xl bg-surface px-3 py-2.5">
            <Text className="ml-1 font-medium text-slate-600">Need longer?</Text>
            <View className="flex-row items-center gap-3">
              <Stepper icon="remove" disabled={hours <= 1} onPress={() => setHours((h) => Math.max(1, h - 1))} label="Fewer hours" />
              <Text className="w-16 text-center text-lg font-bold text-ink">
                {hours} hr{hours > 1 ? 's' : ''}
              </Text>
              <Stepper icon="add" disabled={hours >= MAX_HOURS} onPress={() => setHours((h) => Math.min(MAX_HOURS, h + 1))} label="More hours" />
            </View>
          </View>
        </Step>

        {/* 2. Date */}
        <Step n={2} title="Pick a day">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 py-1" className="-mx-1 px-1">
            {days.map((d, i) => {
              const active = dayIndex === i;
              return (
                <Pressable
                  key={d.toISOString()}
                  onPress={() => setDayIndex(i)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  className={`w-[68px] items-center rounded-2xl border py-3 ${active ? 'border-brand-700 bg-brand-700' : 'border-line bg-white'}`}
                  style={active ? shadow.brand : undefined}
                >
                  <Text className={`text-xs font-semibold uppercase ${active ? 'text-brand-100' : 'text-slate-500'}`}>
                    {i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' })}
                  </Text>
                  <Text className={`mt-1 text-xl font-bold ${active ? 'text-white' : 'text-ink'}`}>{d.getDate()}</Text>
                  <Text className={`text-[11px] ${active ? 'text-brand-100' : 'text-slate-400'}`}>
                    {d.toLocaleDateString('en-US', { month: 'short' })}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Step>

        {/* 3. Time */}
        <Step n={3} title="Start time">
          {slots.length === 0 ? (
            <View className="flex-row items-center gap-2 rounded-2xl bg-accent-50 p-3">
              <Ionicons name="moon-outline" size={18} color={colors.accentDark} />
              <Text className="flex-1 text-[13px] text-accent-700">No more slots today — please pick another day.</Text>
            </View>
          ) : (
            <View className="flex-row flex-wrap gap-2">
              {slots.map((h) => (
                <View key={h} style={{ width: '31.6%' }}>
                  <Chip label={hourLabel(h)} selected={activeSlot === h} onPress={() => setSlot(h)} />
                </View>
              ))}
            </View>
          )}
        </Step>

        {/* 4. Where */}
        <Step n={4} title="Where should they come?">
          <View className="gap-4">
            <Input
              label="Address"
              icon="location-outline"
              placeholder="House #, street, area, city"
              value={address}
              onChangeText={setAddress}
            />
            <Input
              label="Notes for the provider (optional)"
              placeholder={profile?.phone ? `e.g. Call me at ${profile.phone} when you arrive` : 'Anything they should know'}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </View>
        </Step>

        {/* 5. Payment */}
        <Step n={5} title="How would you like to pay?">
          <View className="gap-3">
            <PayOption
              icon="cash-outline"
              title="Pay after the job"
              subtitle="Cash to the provider when the work is done"
              selected={paying === 'cash'}
              onPress={() => setPayWith('cash')}
            />
            <PayOption
              icon="wallet-outline"
              title="Pay from wallet"
              subtitle={
                balance === null
                  ? 'Checking balance…'
                  : walletShort
                    ? `Balance ${formatPrice(balance)} — add ${formatPrice(total - balance)} more`
                    : `Balance ${formatPrice(balance)} · held safely until the job is done`
              }
              selected={paying === 'wallet'}
              disabled={walletShort || balance === null}
              onPress={() => setPayWith('wallet')}
              action={walletShort ? { label: 'Add money', onPress: () => router.push('/wallet/add') } : undefined}
            />
          </View>
        </Step>

        {/* Summary */}
        <Card className="p-5">
          <Text className="mb-2 text-base font-bold text-ink">Price details</Text>
          <PriceRow label={`${formatPrice(rate)} × ${hours} hour${hours > 1 ? 's' : ''}`} value={total} />
          <View className="my-2 h-px bg-slate-100" />
          <PriceRow label="Total" value={total} bold />
          <View className="mt-3 flex-row items-center gap-2 rounded-xl bg-brand-50 p-3">
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.brand} />
            <Text className="flex-1 text-[13px] text-brand-800">
              {paying === 'wallet'
                ? 'Paid now from your wallet, released to the pro only after the job. Cancel before it starts for an instant refund.'
                : 'Pay the provider after the job is done. Free cancellation before it starts.'}
            </Text>
          </View>
        </Card>
      </ScrollView>

      {/* Sticky checkout bar */}
      <View
        className="flex-row items-center gap-4 rounded-t-3xl bg-white px-5 pt-4"
        style={[shadow.top, { paddingBottom: insets.bottom + 12 }]}
      >
        <View>
          <Text className="text-xs font-medium text-slate-500">
            Total · {hours} hr{hours > 1 ? 's' : ''}
          </Text>
          <Text className="text-2xl font-bold text-ink">{formatPrice(total)}</Text>
        </View>
        <Button
          title={ready ? (paying === 'wallet' ? 'Pay & book' : 'Confirm booking') : activeSlot === null ? 'Pick a time' : 'Add address'}
          onPress={onBook}
          loading={submitting}
          disabled={!ready}
          className="flex-1"
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function PayOption({ icon, title, subtitle, selected, disabled, onPress, action }: {
  icon: 'cash-outline' | 'wallet-outline';
  title: string;
  subtitle: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      className={`flex-row items-center gap-3 rounded-2xl border-2 p-3.5 ${selected ? 'border-brand-600 bg-brand-50' : 'border-line bg-white'}`}
    >
      <View className={`h-11 w-11 items-center justify-center rounded-xl ${selected ? 'bg-brand-700' : 'bg-slate-100'}`}>
        <Ionicons name={icon} size={22} color={selected ? colors.white : disabled ? colors.subtle : colors.muted} />
      </View>
      <View className="flex-1">
        <Text className={`text-[15px] font-bold ${disabled ? 'text-slate-400' : 'text-ink'}`}>{title}</Text>
        <Text className="text-xs text-slate-500">{subtitle}</Text>
      </View>
      {action ? (
        <Pressable onPress={action.onPress} hitSlop={8} className="rounded-xl bg-brand-700 px-3 py-2 active:opacity-80">
          <Text className="text-xs font-bold text-white">{action.label}</Text>
        </Pressable>
      ) : (
        <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? colors.brand : colors.line} />
      )}
    </Pressable>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <View className="mb-4 flex-row items-center gap-3">
        <View className="h-7 w-7 items-center justify-center rounded-full bg-brand-700">
          <Text className="text-[13px] font-bold text-white">{n}</Text>
        </View>
        <Text className="text-base font-bold text-ink">{title}</Text>
      </View>
      {children}
    </Card>
  );
}

function Stepper({ icon, onPress, disabled, label }: { icon: 'add' | 'remove'; onPress: () => void; disabled: boolean; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      className={`h-10 w-10 items-center justify-center rounded-full bg-white ${disabled ? 'opacity-40' : ''}`}
      style={shadow.sm}
    >
      <Ionicons name={icon} size={20} color={colors.brandDark} />
    </Pressable>
  );
}
