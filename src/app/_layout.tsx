import '../../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { colors } from '@/lib/theme';
import { AuthProvider } from '@/providers/AuthProvider';

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
        <Stack.Screen
          name="add-service"
          options={{ headerShown: true, title: 'Your service', presentation: 'modal' }}
        />
      </Stack>
    </AuthProvider>
    </GestureHandlerRootView>
  );
}
