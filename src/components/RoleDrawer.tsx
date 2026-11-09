import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, router, usePathname } from 'expo-router';
import { Drawer, DrawerContentScrollView, type DrawerContentComponentProps } from 'expo-router/drawer';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Loader, useStatusBar, type IconName } from '@/components/ui';
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
  useStatusBar('light');

  if (loading) return <Loader />;
  if (!session) return <Redirect href="/login" />;
  if (profile?.role !== role) return <Redirect href="/" />;

  const home = items[0].href;

  return (
    <Drawer
      drawerContent={(props) => <SideMenu {...props} role={role} items={items} />}
      screenOptions={({ navigation }) => ({
        drawerType: 'front',
        overlayColor: 'rgba(15, 23, 42, 0.45)',
        drawerStyle: { width: 300, backgroundColor: colors.white },
        swipeEdgeWidth: 40,
        sceneStyle: { backgroundColor: colors.surface },
        headerStyle: { backgroundColor: colors.brandDeep },
        headerShadowVisible: false,
        headerTintColor: colors.white,
        headerTitleAlign: 'center',
        headerTitle: () => (
          <Pressable onPress={() => router.navigate(home as never)} className="flex-row items-center gap-2" accessibilityLabel="Eizi home">
            <View className="h-8 w-8 items-center justify-center rounded-xl bg-white">
              <Text className="text-base font-black text-brand-700">E</Text>
            </View>
            <Text className="text-lg font-extrabold tracking-tight text-white">Eizi</Text>
          </Pressable>
        ),
        headerLeft: () => (
          <Pressable
            onPress={() => navigation.openDrawer()}
            accessibilityRole="button"
            accessibilityLabel="Open menu"
            hitSlop={8}
            className="ml-3 h-10 w-10 items-center justify-center rounded-xl bg-white/10 active:bg-white/20"
          >
            <Ionicons name="menu" size={24} color={colors.white} />
          </Pressable>
        ),
        headerRight: () => (
          <Pressable
            onPress={() => router.navigate(`/${role}/profile` as never)}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            className="mr-3"
          >
            <Avatar name={profile?.full_name ?? ''} size={36} light />
          </Pressable>
        ),
      })}
    >
      {items.map((i) => (
        <Drawer.Screen key={i.name} name={i.name} options={{ title: i.label }} />
      ))}
    </Drawer>
  );
}

function SideMenu({ navigation, role, items }: DrawerContentComponentProps & { role: Role; items: MenuItem[] }) {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const [switching, setSwitching] = useState(false);

  const isProvider = role === 'provider';
  const name = profile?.full_name || 'Your name';

  function go(href: string) {
    navigation.closeDrawer();
    router.navigate(href as never);
  }

  async function switchRole() {
    if (!profile) return;
    setSwitching(true);
    const { error } = await supabase
      .from('profiles')
      .update({ role: isProvider ? 'customer' : 'provider' })
      .eq('id', profile.id);
    if (error) {
      setSwitching(false);
      Alert.alert('Could not switch', error.message);
      return;
    }
    navigation.closeDrawer();
    await refreshProfile();
    setSwitching(false);
    router.replace('/');
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

        <View className="my-3 h-px bg-slate-100" />
        <Text className="mb-2 px-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">Account</Text>

        <Pressable
          onPress={switching ? undefined : switchRole}
          className="mb-1 flex-row items-center gap-3 rounded-2xl px-3 py-3 active:bg-slate-50"
        >
          <View className="h-9 w-9 items-center justify-center rounded-xl bg-accent-50">
            <Ionicons name="swap-horizontal" size={19} color={colors.accentDark} />
          </View>
          <View className="flex-1">
            <Text className="text-[15px] font-semibold text-slate-700">
              {isProvider ? 'Switch to customer' : 'Become a provider'}
            </Text>
            <Text className="text-xs text-slate-400">{isProvider ? 'Book services for yourself' : 'Earn with your skills'}</Text>
          </View>
        </Pressable>
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
