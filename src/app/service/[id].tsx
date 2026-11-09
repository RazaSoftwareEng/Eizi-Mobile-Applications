import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, Text, View } from 'react-native';

import { Avatar, Button, Card, EmptyState, Loader, ServiceIcon } from '@/components/ui';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { colors, tintFor } from '@/lib/theme';
import type { Service } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';

type Offer = {
  id: number;
  hourly_rate: number;
  description: string;
  provider: { id: string; full_name: string; created_at: string; avatar_url: string | null; bio: string } | null;
};

export default function ServiceProviders() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [service, setService] = useState<Service | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [svc, list] = await Promise.all([
        supabase.from('services').select('*').eq('id', id).single(),
        supabase
          .from('provider_services')
          .select('id, hourly_rate, description, provider:profiles(id, full_name, created_at, avatar_url, bio)')
          .eq('service_id', id)
          .eq('is_active', true)
          .order('hourly_rate'),
      ]);
      setService(svc.data as Service | null);
      // Hide the user's own listing in case they also offer this service.
      setOffers(((list.data as unknown as Offer[]) ?? []).filter((o) => o.provider?.id !== session?.user.id));
      setLoading(false);
    })();
  }, [id, session?.user.id]);

  if (loading) return <Loader />;

  const tint = tintFor(Number(id));
  const from = offers.length ? Math.min(...offers.map((o) => Number(o.hourly_rate))) : null;

  return (
    <View className="flex-1 bg-surface">
      <Stack.Screen options={{ title: service?.name ?? 'Service' }} />
      <FlatList
        data={offers}
        keyExtractor={(o) => String(o.id)}
        contentContainerClassName="gap-4 px-5 pb-10 pt-1"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          service ? (
            <View className="mb-2">
              <View className="flex-row items-center gap-3 overflow-hidden rounded-3xl p-5" style={{ backgroundColor: tint.bg }}>
                <View className="flex-1">
                  <Text className="text-2xl font-bold text-ink">{service.name}</Text>
                  <Text className="mt-1 leading-5 text-slate-600">{service.description}</Text>
                </View>
                {service.image_url ? (
                  <Image
                    source={{ uri: service.image_url }}
                    style={{ width: 112, height: 96, marginVertical: -8 }}
                    resizeMode="contain"
                    accessibilityLabel={`${service.name} illustration`}
                  />
                ) : (
                  <ServiceIcon service={service} tintId={service.id} size={64} onColor />
                )}
              </View>

              {offers.length ? (
                <View className="mt-4 flex-row gap-3">
                  <Fact icon="people" label={`${offers.length} ${offers.length === 1 ? 'pro' : 'pros'} available`} />
                  {from !== null ? <Fact icon="pricetag" label={`from ${formatPrice(from)}/hr`} /> : null}
                </View>
              ) : null}

              {offers.length ? <Text className="mt-6 text-lg font-bold text-ink">Choose a professional</Text> : null}
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="No pros available yet"
            subtitle="Nobody is offering this service right now. Please check back soon."
          >
            <Button title="Browse other services" variant="secondary" onPress={() => router.back()} />
          </EmptyState>
        }
        renderItem={({ item }) => {
          const since = item.provider?.created_at ? new Date(item.provider.created_at).getFullYear() : null;
          return (
            <Card className="p-4">
              <View className="flex-row items-center gap-3">
                <Avatar name={item.provider?.full_name ?? ''} size={52} uri={item.provider?.avatar_url} />
                <View className="flex-1">
                  <Text className="text-base font-bold text-ink" numberOfLines={1}>
                    {item.provider?.full_name || 'Provider'}
                  </Text>
                  {since ? <Text className="mt-0.5 text-[13px] text-slate-500">On Eizi since {since}</Text> : null}
                </View>
                <View className="items-end rounded-2xl bg-brand-50 px-3 py-2">
                  <Text className="text-lg font-bold text-brand-700">{formatPrice(item.hourly_rate)}</Text>
                  <Text className="text-[11px] font-medium text-brand-600">per hour</Text>
                </View>
              </View>

              {item.description ? (
                <Text className="mt-4 leading-5 text-slate-600" numberOfLines={3}>
                  {item.description}
                </Text>
              ) : null}
              {item.provider?.bio ? <ProviderBio bio={item.provider.bio} /> : null}

              <View className="mt-4 flex-row items-center gap-2">
                <View className="flex-1 flex-row items-center gap-1.5">
                  <Ionicons name="time-outline" size={16} color={colors.muted} />
                  <Text className="text-[13px] text-slate-500">
                    2 hrs ≈ {formatPrice(Number(item.hourly_rate) * 2)}
                  </Text>
                </View>
                <Button
                  title="Book now"
                  size="md"
                  className="px-6"
                  onPress={() => router.push({ pathname: '/book/[id]', params: { id: String(item.id) } })}
                />
              </View>
            </Card>
          );
        }}
      />
    </View>
  );
}

function Fact({ icon, label }: { icon: 'people' | 'pricetag'; label: string }) {
  return (
    <Card elevated="sm" className="flex-1 flex-row items-center gap-2 rounded-2xl px-3 py-3">
      <Ionicons name={icon} size={16} color={colors.brand} />
      <Text className="flex-1 text-[13px] font-semibold text-ink" numberOfLines={1}>
        {label}
      </Text>
    </Card>
  );
}

function ProviderBio({ bio }: { bio: string }) {
  const [open, setOpen] = useState(false);
  const long = bio.length > 160;
  return (
    <View className="mt-3 rounded-2xl bg-surface p-3">
      <Text className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">About</Text>
      <Text className="text-[13px] leading-5 text-slate-600" numberOfLines={open ? undefined : 3}>
        {bio}
      </Text>
      {long ? (
        <Pressable onPress={() => setOpen((o) => !o)} hitSlop={8} className="mt-1 self-start">
          <Text className="text-[13px] font-semibold text-brand-700">{open ? 'Show less' : 'Read more'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
