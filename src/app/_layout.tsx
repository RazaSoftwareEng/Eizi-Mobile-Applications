import '../../global.css';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplash } from '@/components/AnimatedSplash';
import { UpdateBanner } from '@/components/UpdateBanner';
import { colors } from '@/lib/theme';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';

// Keep the native splash up until the animated intro has drawn its first frame.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            headerTintColor: colors.ink,
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.surface },
            headerTitleStyle: { fontWeight: '700', fontSize: 17 },
            headerBackButtonDisplayMode: 'minimal',
            contentStyle: { backgroundColor: colors.surface },
          }}
        >
          <Stack.Screen name="service/[id]" options={{ headerShown: true, title: '' }} />
          <Stack.Screen name="book/[id]" options={{ headerShown: true, title: 'Book a service' }} />
          <Stack.Screen name="wallet/add" options={{ headerShown: true, title: 'Add money' }} />
          <Stack.Screen name="wallet/withdraw" options={{ headerShown: true, title: 'Withdraw' }} />
          <Stack.Screen name="add-service" options={{ headerShown: true, title: 'Your service', presentation: 'modal' }} />
        </Stack>
        <UpdateBanner />
        <Intro />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

/** Plays over the app while the saved session & profile load, then reveals the right screen. */
function Intro() {
  const { loading } = useAuth();
  return <AnimatedSplash ready={!loading} />;
}
