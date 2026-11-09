import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, router, usePathname } from 'expo-router';
import { Drawer, DrawerContentScrollView, type DrawerContentComponentProps } from 'expo-router/drawer';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Loader, type IconName } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, shadow } from '@/lib/theme';
import type { Role } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';

export type MenuItem = {
  /** Route file name inside the role folder, e.g. "index", "bookings". */
  name: string;
  /** Absolute path used for navigation & highlighting, e.g. "/customer/bookings". */
  href: string;
  label: string;
  icon: IconName;
  iconActive: IconName;
};

/** Top app bar + slide-out side menu, only for a signed-in user with the given role. */
export function RoleDrawer({ role, items }: { role: Role; items: MenuItem[] }) {
  const { session, profile, loading } = useAuth();

  if (loading) return <Loader />;
  if (!session) return <Redirect href="/login" />;
  if (profile?.role !== role) return <Redirect href="/" />;

  const home = items[0].href;

  return (
    <Drawer
      drawerContent={(props) => <SideMenu {...props} role={role} items={items} />}
      screenOptions={({ navigation, route }) => ({
        drawerType: 'front',
        overlayColor: 'rgba(15, 23, 42, 0.45)',
        drawerStyle: { width: 300, backgroundColor: colors.white },
        swipeEdgeWidth: 40,
        sceneStyle: { backgroundColor: colors.surface },
        // Light app bar; on the customer home it matches the top of the hero gradient so they read as one surface.
        headerStyle: { backgroundColor: route.name === 'index' || route.name === 'profile' ? colors.heroTop : colors.surface },
        headerShadowVisible: false,
        headerTintColor: colors.ink,
        headerTitleAlign: 'center',
        headerTitle: () => (
          <Pressable onPress={() => router.navigate(home as never)} className="flex-row items-center gap-2" accessibilityLabel="Eizi home">
            <Image source={require('../../assets/splash-icon.png')} style={[{ width: 36, height: 36 }, shadow.sm]} />
            <Text className="text-xl font-extrabold tracking-tight text-ink">Eizi</Text>
          </Pressable>
        ),
        headerLeft: () => (
          <RoundButton icon="menu" label="Open menu" onPress={() => navigation.openDrawer()} style={{ marginLeft: 16 }} />
        ),
        headerRight: () => <AlertsBell role={role} />,
      })}
    >
      {items.map((i) => (
        <Drawer.Screen key={i.name} name={i.name} options={{ title: i.label }} />
      ))}
    </Drawer>
  );
}

function RoundButton({ icon, label, onPress, style }: { icon: IconName; label: string; onPress: () => void; style?: object }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      className="h-11 w-11 items-center justify-center rounded-full bg-white active:bg-slate-50"
      style={[shadow.md, style]}
    >
      <Ionicons name={icon} size={22} color={colors.ink} />
    </Pressable>
  );
}

/**
 * Bell that leads to what needs attention, with a dot when something does:
 * providers → new booking requests; customers → confirmed upcoming bookings.
 */
function AlertsBell({ role }: { role: Role }) {
  const { session } = useAuth();
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!session) return;
    let alive = true;
    const check = async () => {
      const q = supabase.from('bookings').select('id', { count: 'exact', head: true });
      const { count: c } =
        role === 'provider'
          ? await q.eq('provider_id', session.user.id).eq('status', 'pending')
          : await q.eq('customer_id', session.user.id).eq('status', 'accepted').gte('scheduled_at', new Date().toISOString());
      if (alive) setCount(c ?? 0);
    };
    check();
    const t = setInterval(check, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [session, role, pathname]);

  const label =
    role === 'provider'
      ? count ? `${count} new booking request${count > 1 ? 's' : ''}` : 'Booking requests'
      : count ? `${count} confirmed upcoming booking${count > 1 ? 's' : ''}` : 'My bookings';

  return (
    <View style={{ marginRight: 16 }}>
      <RoundButton
        icon="notifications-outline"
        label={label}
        onPress={() => router.navigate((role === 'provider' ? '/provider' : '/customer/bookings') as never)}
      />
      {count ? (
        <View
          pointerEvents="none"
          className="absolute -right-0.5 -top-0.5 h-4 min-w-4 items-center justify-center rounded-full border-2 border-white bg-red-500 px-0.5"
        >
          {count > 1 ? <Text className="text-[9px] font-bold text-white">{count > 9 ? '9+' : count}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

function SideMenu({ navigation, role, items }: DrawerContentComponentProps & { role: Role; items: MenuItem[] }) {
  const { session, profile, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  const isProvider = role === 'provider';
  const name = profile?.full_name || 'Your name';

  function go(href: string) {
    navigation.closeDrawer();
    router.navigate(href as never);
  }

  function confirmLogout() {
    Alert.alert('Log out?', 'You can log back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: signOut },
    ]);
  }

  return (
    <View className="flex-1 bg-white">
      {/* Profile header */}
      <View className="overflow-hidden bg-brand-800 px-5 pb-6" style={{ paddingTop: insets.top + 20 }}>
        <View className="absolute -right-16 -top-12 h-48 w-48 rounded-full bg-white/5" />
        <View className="rounded-full self-start border-4 border-white/15">
          <Avatar name={name} size={60} light />
        </View>
        <Text className="mt-3 text-lg font-bold text-white" numberOfLines={1}>
          {name}
        </Text>
        <Text className="text-[13px] text-brand-200" numberOfLines={1}>
          {session?.user.email}
        </Text>
        <View className="mt-3 flex-row items-center gap-1.5 self-start rounded-full bg-white/15 px-3 py-1">
          <MaterialCommunityIcons name={isProvider ? 'account-hard-hat' : 'home-heart'} size={13} color={colors.white} />
          <Text className="text-[11px] font-bold uppercase tracking-wider text-white">
            {isProvider ? 'Service provider' : 'Customer'}
          </Text>
        </View>
      </View>

      <DrawerContentScrollView contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 12 }}>
        <Text className="mb-2 px-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">Menu</Text>
        {items.map((i) => {
          const active = pathname === i.href || (i.name === 'index' && pathname === i.href.replace(/\/$/, ''));
          return (
            <Pressable
              key={i.name}
              onPress={() => go(i.href)}
              accessibilityRole="menuitem"
              accessibilityState={{ selected: active }}
              className={`mb-1 flex-row items-center gap-3 rounded-2xl px-3 py-3 ${active ? 'bg-brand-50' : 'active:bg-slate-50'}`}
            >
              <View
                className={`h-9 w-9 items-center justify-center rounded-xl ${active ? 'bg-brand-700' : 'bg-slate-100'}`}
                style={active ? shadow.brand : undefined}
              >
                <Ionicons name={active ? i.iconActive : i.icon} size={19} color={active ? colors.white : colors.muted} />
              </View>
              <Text className={`flex-1 text-[15px] ${active ? 'font-bold text-brand-800' : 'font-semibold text-slate-700'}`}>
                {i.label}
              </Text>
              {active ? <View className="h-2 w-2 rounded-full bg-brand-600" /> : null}
            </Pressable>
          );
        })}
      </DrawerContentScrollView>

      {/* Footer */}
      <View className="border-t border-slate-100 px-3 pt-2" style={{ paddingBottom: insets.bottom + 8 }}>
        <Pressable onPress={confirmLogout} className="flex-row items-center gap-3 rounded-2xl px-3 py-3 active:bg-red-50">
          <View className="h-9 w-9 items-center justify-center rounded-xl bg-red-50">
            <Ionicons name="log-out-outline" size={19} color={colors.danger} />
          </View>
          <Text className="flex-1 text-[15px] font-semibold text-red-600">Log out</Text>
        </Pressable>
        <Text className="mt-1 px-3 text-[11px] text-slate-400">Eizi · v1.0.0</Text>
      </View>
    </View>
  );
}
