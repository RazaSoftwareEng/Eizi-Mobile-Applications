import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, Switch, Text, View } from 'react-native';

import { Button, Card, EmptyState, Loader, ScreenHeader, ServiceIcon } from '@/components/ui';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { colors, shadow } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

type MyService = {
  id: number;
  service_id: number;
  hourly_rate: number;
  description: string;
  is_active: boolean;
  service: { name: string; icon: string } | null;
};

export default function ProviderServices() {
  const { session } = useAuth();
  const [items, setItems] = useState<MyService[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const { data, error } = await supabase
      .from('provider_services')
      .select('id, service_id, hourly_rate, description, is_active, service:services(name, icon)')
      .eq('provider_id', session.user.id)
      .order('created_at');
    if (error) Alert.alert('Could not load services', error.message);
    setItems((data as unknown as MyService[]) ?? []);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load]),
  );

  async function toggle(item: MyService, value: boolean) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_active: value } : i)));
    const { error } = await supabase.from('provider_services').update({ is_active: value }).eq('id', item.id);
    if (error) {
      Alert.alert('Could not update', error.message);
      load();
    }
  }

  function remove(item: MyService) {
    Alert.alert(`Remove ${item.service?.name}?`, 'Customers will no longer see this service from you.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('provider_services').delete().eq('id', item.id);
          if (error) Alert.alert('Could not remove', error.message);
          load();
        },
      },
    ]);
  }

  if (loading) return <Loader />;

  const liveCount = items.filter((i) => i.is_active).length;

  return (
    <View className="flex-1 bg-surface">
      <FlatList
        data={items}
        keyExtractor={(i) => String(i.id)}
        contentContainerClassName="gap-4 px-5 pb-32"
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
          <View className="-mx-5">
            <ScreenHeader
              title="My services"
              subtitle={items.length ? `${liveCount} of ${items.length} visible to customers` : 'What you offer and your hourly price'}
            />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="briefcase-outline"
            title="Add your first service"
            subtitle="Choose what you do — like Cook or Electrician — and set your price per hour to start getting bookings."
          />
        }
        renderItem={({ item }) => {
          return (
            <Card className="p-4" style={item.is_active ? undefined : { opacity: 0.7 }}>
              <View className="flex-row items-center gap-3">
                <ServiceIcon service={item.service} tintId={item.service_id} size={52} />
                <View className="flex-1">
                  <Text className="text-base font-bold text-ink">{item.service?.name}</Text>
                  <Text className="mt-0.5 text-[15px] font-bold text-brand-700">
                    {formatPrice(item.hourly_rate)}
                    <Text className="text-[13px] font-medium text-slate-500"> / hour</Text>
                  </Text>
                </View>
                <Switch
                  value={item.is_active}
                  onValueChange={(v) => toggle(item, v)}
                  trackColor={{ true: colors.brand, false: colors.line }}
                  thumbColor={colors.white}
                  accessibilityLabel={`Show ${item.service?.name} to customers`}
                />
              </View>

              {item.description ? (
                <Text className="mt-3 leading-5 text-slate-600" numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}

              <View className="mt-4 flex-row items-center justify-between border-t border-slate-100 pt-3">
                <View className={`flex-row items-center gap-1.5 rounded-full px-2.5 py-1 ${item.is_active ? 'bg-emerald-50' : 'bg-slate-100'}`}>
                  <View className={`h-1.5 w-1.5 rounded-full ${item.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  <Text className={`text-xs font-semibold ${item.is_active ? 'text-emerald-700' : 'text-slate-500'}`}>
                    {item.is_active ? 'Live' : 'Paused'}
                  </Text>
                </View>
                <View className="flex-row gap-2">
                  <IconButton
                    icon="create-outline"
                    label="Edit"
                    onPress={() => router.push({ pathname: '/add-service', params: { serviceId: String(item.service_id) } })}
                  />
                  <IconButton icon="trash-outline" label="Remove" danger onPress={() => remove(item)} />
                </View>
              </View>
            </Card>
          );
        }}
      />

      <View className="absolute bottom-5 left-5 right-5">
        <Button title="Add a service" icon="add" onPress={() => router.push('/add-service')} />
      </View>
    </View>
  );
}

function IconButton({ icon, label, onPress, danger }: {
  icon: 'create-outline' | 'trash-outline';
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      className={`flex-row items-center gap-1 rounded-xl px-3 py-2 ${danger ? 'bg-red-50' : 'bg-brand-50'}`}
      style={({ pressed }) => [pressed ? undefined : shadow.sm, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Ionicons name={icon} size={16} color={danger ? colors.danger : colors.brandDark} />
      <Text className={`text-[13px] font-semibold ${danger ? 'text-red-600' : 'text-brand-700'}`}>{label}</Text>
    </Pressable>
  );
}
