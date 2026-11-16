import type { ReactNode } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStatusBar } from '@/components/ui';
import { colors } from '@/lib/theme';

/** Light, airy screen with the full Eizi logo on top — shared by login & sign up. */
export function AuthShell({ title, subtitle, children, footer }: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  useStatusBar('dark');

  return (
    <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* soft teal waves in the corners */}
      <View pointerEvents="none" className="absolute -right-24 -top-28 h-72 w-72 rounded-full" style={{ backgroundColor: colors.heroTop }} />
      <View pointerEvents="none" className="absolute -left-28 bottom-[-120px] h-80 w-80 rounded-full" style={{ backgroundColor: '#EEF9F7' }} />
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow px-6"
        contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center">
          <Image
            source={require('../../assets/logo-full.png')}
            style={{ width: 170, height: 128 }}
            resizeMode="contain"
            accessibilityLabel="Eizi, Your Home, Our Care"
          />
        </View>

        <Text className="mt-8 text-[28px] font-bold tracking-tight text-ink">{title}</Text>
        <Text className="mb-6 mt-1 text-[15px] leading-6 text-slate-500">{subtitle}</Text>

        {children}
        {footer ? <View className="mt-8">{footer}</View> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
