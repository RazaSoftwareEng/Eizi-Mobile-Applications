import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStatusBar } from '@/components/ui';
import { shadow } from '@/lib/theme';

/** Teal brand hero on top, white rounded sheet below — shared by login & sign up. */
export function AuthShell({ title, subtitle, children, footer }: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  useStatusBar('light');

  return (
    <KeyboardAvoidingView className="flex-1 bg-brand-800" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Hero */}
        <View className="overflow-hidden px-6 pb-12" style={{ paddingTop: insets.top + 28 }}>
          <View className="absolute -right-16 -top-10 h-56 w-56 rounded-full bg-white/5" />
          <View className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-brand-600/40" />

          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white" style={shadow.lg}>
              <Text className="text-2xl font-black text-brand-700">E</Text>
            </View>
            <Text className="text-2xl font-extrabold tracking-tight text-white">Eizi</Text>
          </View>

          <Text className="mt-8 text-[32px] font-bold leading-10 tracking-tight text-white">{title}</Text>
          <Text className="mt-2 text-base leading-6 text-brand-100">{subtitle}</Text>
        </View>

        {/* Sheet */}
        <View className="flex-1 rounded-t-[32px] bg-surface px-6 pt-8" style={{ paddingBottom: insets.bottom + 24 }}>
          {children}
          {footer ? <View className="mt-8">{footer}</View> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
