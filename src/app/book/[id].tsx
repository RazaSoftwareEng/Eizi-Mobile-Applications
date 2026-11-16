import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FreeMap } from '@/components/FreeMap';
import { Button, Card, Chip, EmptyState, Input, Loader, Segmented } from '@/components/ui';
import { formatPrice } from '@/lib/format';
import { addressFor, DEFAULT_CENTER, getCurrentLocation, lastKnownLocation, LocationError, openInMaps, type Coords } from '@/lib/location';
import { supabase } from '@/lib/supabase';
import { colors, shadow } from '@/lib/theme';
import type { Service, ServiceTask } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';

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
  return `${h % 12 === 0 ? 12 : h % 12}:00 ${h >= 12 ? 'PM' : 'AM'}`;
}

/** Step 2 of a request: where (GPS pin + address) and when, then send it to nearby workers. */
export default function SetAddress() {
  const { id, tasks: tasksParam } = useLocalSearchParams<{ id: string; tasks?: string }>();
  const { session, profile } = useAuth();
  const insets = useSafeAreaInsets();

  const taskIds = useMemo(
    () => (tasksParam ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0),
    [tasksParam],
  );
  const [service, setService] = useState<Service | null>(null);
  const [tasks, setTasks] = useState<ServiceTask[]>([]);
  const [loading, setLoading] = useState(true);

  // Start from the location the home map already found.
  const known = lastKnownLocation();
  const [coords, setCoords] = useState<Coords | null>(known ? { latitude: known.latitude, longitude: known.longitude } : null);
  const [locating, setLocating] = useState(false);
  const [address, setAddressState] = useState(known?.address ?? '');
  const addressIsAuto = useRef(!!known?.address); // filled by the map → may be replaced when the pin moves
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setAddress = (v: string, auto = false) => {
    addressIsAuto.current = auto;
    setAddressState(v);
  };
  const [notes, setNotes] = useState('');
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const days = useMemo(() => nextDays(7), []);
  const [dayIndex, setDayIndex] = useState(0);
  const [slot, setSlot] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const [svc, list] = await Promise.all([
        supabase.from('services').select('*').eq('id', id).maybeSingle(),
        taskIds.length ? supabase.from('service_tasks').select('*').in('id', taskIds).order('sort') : Promise.resolve({ data: [] }),
      ]);
      setService(svc.data as Service | null);
      setTasks((list.data as ServiceTask[]) ?? []);
      setLoading(false);
    })();
  }, [id, taskIds]);

  const slots = useMemo(() => {
    const all = Array.from({ length: LAST_SLOT - FIRST_SLOT + 1 }, (_, i) => FIRST_SLOT + i);
    if (dayIndex !== 0) return all;
    const nowHour = new Date().getHours();
    return all.filter((h) => h > nowHour);
  }, [dayIndex]);
  const activeSlot = slot !== null && slots.includes(slot) ? slot : null;

  if (loading) return <Loader />;
  if (!service || tasks.length === 0) {
    return (
      <EmptyState icon="alert-circle-outline" title="Nothing selected" subtitle="Go back and tick at least one job.">
        <Button title="Go back" variant="secondary" onPress={() => router.back()} />
      </EmptyState>
    );
  }

  const timeReady = when === 'now' || activeSlot !== null;
  const ready = address.trim().length >= 3 && timeReady;

  async function useMyLocation() {
    setLocating(true);
    try {
      const loc = await getCurrentLocation();
      setCoords({ latitude: loc.latitude, longitude: loc.longitude });
      if (loc.address) setAddress(loc.address, true);
      else if (!address.trim()) setAddress(`Pinned location (${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)})`, true);
    } catch (e) {
      if (e instanceof LocationError && e.openSettings) {
        Alert.alert('Location is off', e.message, [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open settings', onPress: () => Linking.openSettings() },
        ]);
      } else {
        Alert.alert('Could not get location', e instanceof Error ? e.message : 'Please try again or type your address.');
      }
    } finally {
      setLocating(false);
    }
  }

  // Dragging the map moves the pin; refresh the street name unless the user typed their own.
  function onPinMove(c: Coords) {
    setCoords(c);
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    if (address.trim() && !addressIsAuto.current) return;
    geocodeTimer.current = setTimeout(async () => {
      const a = await addressFor(c);
      if (a && (addressIsAuto.current || !address.trim())) setAddress(a, true);
    }, 500);
  }

  async function dispatch() {
    if (!session || !service) return;
    if (!ready) {
      Alert.alert(!timeReady ? 'Pick a time' : 'Address required', !timeReady ? 'Choose when the worker should come.' : 'Please add where the service is needed.');
      return;
    }
    let scheduled = new Date();
    if (when === 'later' && activeSlot !== null) {
      scheduled = new Date(days[dayIndex]);
      scheduled.setHours(activeSlot, 0, 0, 0);
    }
    setSubmitting(true);
    // Fee, task names and the worker are decided by the server.
    const { error } = await supabase.from('bookings').insert({
      customer_id: session.user.id,
      service_id: service.id,
      task_ids: tasks.map((t) => t.id),
      address: address.trim(),
      notes: notes.trim(),
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
      scheduled_at: scheduled.toISOString(),
    });
    setSubmitting(false);
    if (error) {
      Alert.alert('Request not sent', error.message);
      return;
    }
    Alert.alert(
      'Request sent',
      `We've sent it to ${service.name.toLowerCase()} workers near you. You'll get a notification as soon as one accepts.`,
    );
    router.dismissAll();
    router.replace('/customer/bookings');
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-surface" behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerClassName="gap-4 px-5 pb-8 pt-1" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Where */}
        <Section icon="location" title="Where should they come?">
          <View className="gap-4">
            <View className="overflow-hidden rounded-2xl border border-line">
              <FreeMap center={coords ?? DEFAULT_CENTER} zoom={coords ? 16.5 : 11} interactive onMove={onPinMove} style={{ height: 230 }} />
              <View className="flex-row items-center gap-2 bg-white px-3 py-2">
                <Ionicons name="hand-left-outline" size={14} color={colors.muted} />
                <Text className="flex-1 text-xs text-slate-500">Drag the map to put the pin exactly on your door</Text>
              </View>
            </View>
            <LocationPanel coords={coords} locating={locating} onUse={useMyLocation} onRemove={() => setCoords(null)} />
            <Input
              label="Address"
              icon="home-outline"
              placeholder={coords ? 'Add house # / floor so they find the door' : `House #, street, area${profile?.city ? `, ${profile.city}` : ', city'}`}
              value={address}
              onChangeText={setAddress}
            />
            <Input
              label="Notes for the worker (optional)"
              placeholder={profile?.phone ? `e.g. Call me at ${profile.phone} when you arrive` : 'Anything they should know'}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </View>
        </Section>

        {/* When */}
        <Section icon="time" title="When?">
          <Segmented
            options={[
              { value: 'now', label: 'As soon as possible' },
              { value: 'later', label: 'Schedule' },
            ]}
            value={when}
            onChange={setWhen}
          />
          {when === 'later' ? (
            <View className="mt-4 gap-3">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 py-1" className="-mx-1 px-1">
                {days.map((d, i) => {
                  const active = dayIndex === i;
                  return (
                    <Pressable
                      key={d.toISOString()}
                      onPress={() => setDayIndex(i)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      className={`w-[64px] items-center rounded-2xl border py-2.5 ${active ? 'border-brand-700 bg-brand-700' : 'border-line bg-white'}`}
                      style={active ? shadow.brand : undefined}
                    >
                      <Text className={`text-[11px] font-semibold uppercase ${active ? 'text-brand-100' : 'text-slate-500'}`}>
                        {i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' })}
                      </Text>
                      <Text className={`mt-0.5 text-lg font-bold ${active ? 'text-white' : 'text-ink'}`}>{d.getDate()}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {slots.length === 0 ? (
                <Text className="text-[13px] text-slate-500">No more slots today, please pick another day.</Text>
              ) : (
                <View className="flex-row flex-wrap gap-2">
                  {slots.map((h) => (
                    <View key={h} style={{ width: '31.6%' }}>
                      <Chip label={hourLabel(h)} selected={activeSlot === h} onPress={() => setSlot(h)} />
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : null}
        </Section>

        {/* Summary */}
        <Card className="p-5">
          <Text className="text-base font-bold text-ink">{service.name}</Text>
          <View className="mt-3 gap-2">
            {tasks.map((t) => (
              <View key={t.id} className="flex-row items-center gap-2">
                <Ionicons name="checkmark-circle" size={18} color={colors.brand} />
                <Text className="flex-1 text-[14px] text-slate-700">{t.name}</Text>
              </View>
            ))}
          </View>
          <View className="my-4 h-px bg-slate-100" />
          <View className="flex-row items-center justify-between">
            <Text className="text-[14px] text-slate-600">Total tasks</Text>
            <Text className="text-[15px] font-bold text-ink">{tasks.length}</Text>
          </View>
          <View className="mt-2 flex-row items-center justify-between">
            <Text className="text-[14px] text-slate-600">Base visiting fee</Text>
            <Text className="text-[15px] font-bold text-ink">{formatPrice(service.visit_fee)}</Text>
          </View>
          <View className="mt-3 flex-row items-start gap-2 rounded-xl bg-brand-50 p-3">
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.brand} />
            <Text className="flex-1 text-[13px] leading-5 text-brand-800">
              The worker checks the job on site and sends you the final price. Work starts only after you approve it, and the
              visiting fee is adjusted in that price.
            </Text>
          </View>
        </Card>
      </ScrollView>

      <View className="rounded-t-3xl bg-white px-5 pt-4" style={[shadow.top, { paddingBottom: insets.bottom + 12 }]}>
        <Button
          title={ready ? 'Dispatch booking request' : address.trim().length < 3 ? 'Add your address' : 'Pick a time'}
          icon="paper-plane"
          onPress={dispatch}
          loading={submitting}
          disabled={!ready}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function Section({ icon, title, children }: { icon: 'location' | 'time'; title: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <View className="mb-4 flex-row items-center gap-3">
        <View className="h-8 w-8 items-center justify-center rounded-full bg-brand-700">
          <Ionicons name={icon} size={16} color={colors.white} />
        </View>
        <Text className="text-base font-bold text-ink">{title}</Text>
      </View>
      {children}
    </Card>
  );
}

function LocationPanel({ coords, locating, onUse, onRemove }: {
  coords: Coords | null;
  locating: boolean;
  onUse: () => void;
  onRemove: () => void;
}) {
  if (coords) {
    return (
      <View className="flex-row items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
        <View className="h-11 w-11 items-center justify-center rounded-xl bg-emerald-600">
          <Ionicons name="navigate" size={20} color={colors.white} />
        </View>
        <View className="flex-1">
          <Text className="text-[14px] font-bold text-emerald-900">Current location pinned</Text>
          <Text className="text-xs text-emerald-800">Workers get directions to this exact spot</Text>
        </View>
        <Pressable onPress={() => openInMaps(coords)} hitSlop={8} accessibilityLabel="Check location on map" className="rounded-lg px-2 py-1.5 active:opacity-70">
          <Text className="text-xs font-bold text-emerald-700">View</Text>
        </Pressable>
        <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel="Remove location" className="rounded-lg px-1 py-1.5 active:opacity-70">
          <Ionicons name="close-circle" size={20} color={colors.muted} />
        </Pressable>
      </View>
    );
  }
  return (
    <Pressable
      onPress={onUse}
      disabled={locating}
      accessibilityRole="button"
      className="flex-row items-center gap-3 rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50 p-3 active:opacity-80"
    >
      <View className="h-11 w-11 items-center justify-center rounded-xl bg-brand-700">
        {locating ? <ActivityIndicator color={colors.white} /> : <Ionicons name="locate" size={20} color={colors.white} />}
      </View>
      <View className="flex-1">
        <Text className="text-[14px] font-bold text-brand-800">{locating ? 'Finding your location…' : 'Use my current location'}</Text>
        <Text className="text-xs text-brand-700">Pins your spot so nearby workers can reach you</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.brand} />
    </Pressable>
  );
}
