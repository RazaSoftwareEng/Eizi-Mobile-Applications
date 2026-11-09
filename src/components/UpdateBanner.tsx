import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, shadow } from '@/lib/theme';

/**
 * expo-updates checks for a new OTA update on every launch and downloads it in the background.
 * Normally it would only appear on the *next* launch — this banner lets the user switch to it right away.
 * Renders nothing in Expo Go / development (updates are disabled there).
 */
export function UpdateBanner() {
  if (!Updates.isEnabled) return null;
  return <Banner />;
}

function Banner() {
  const { isUpdatePending } = Updates.useUpdates();
  const insets = useSafeAreaInsets();
  const [dismissed, setDismissed] = useState(false);
  const [restarting, setRestarting] = useState(false);

  if (!isUpdatePending || dismissed) return null;

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 16, zIndex: 900 }}>
      <View className="flex-row items-center gap-3 rounded-2xl bg-ink px-4 py-3" style={shadow.lg} accessibilityLiveRegion="polite">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-white/10">
          <Ionicons name="sparkles" size={18} color={colors.white} />
        </View>
        <View className="flex-1">
          <Text className="text-[15px] font-bold text-white">New version ready</Text>
          <Text className="text-xs text-slate-300">Restart to get the latest Eizi</Text>
        </View>
        <Pressable onPress={() => setDismissed(true)} hitSlop={8} accessibilityLabel="Later" className="px-1">
          <Text className="text-[13px] font-semibold text-slate-300">Later</Text>
        </Pressable>
        <Pressable
          onPress={async () => {
            setRestarting(true);
            await Updates.reloadAsync();
          }}
          disabled={restarting}
          accessibilityRole="button"
          className="rounded-xl bg-white px-3.5 py-2 active:opacity-80"
        >
          <Text className="text-[13px] font-bold text-brand-800">{restarting ? 'Restarting…' : 'Restart'}</Text>
        </Pressable>
      </View>
    </View>
  );
}
