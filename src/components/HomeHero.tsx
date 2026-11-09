import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';

import { HeroArt } from '@/components/HeroArt';
import { colors } from '@/lib/theme';

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Shared home header (customer & provider): soft gradient, greeting + name beside the floating logo,
 * then a full-width headline with one highlighted word — laid out in rows so text never runs under the art.
 */
export function HomeHero({ name, line1, line2, highlight, children }: {
  name: string;
  line1: string;
  line2: string;
  highlight: string;
  children?: ReactNode;
}) {
  const firstName = name.trim().split(/\s+/)[0] || 'there';
  const { width } = useWindowDimensions();
  // Smaller headline on narrow phones (320–359px) so it never crowds the art or wraps awkwardly.
  const head = width < 360 ? { fontSize: 23, lineHeight: 30 } : { fontSize: 26, lineHeight: 34 };
  const artScale = width < 360 ? 0.64 : 0.74;

  return (
    <View
      className="overflow-hidden px-5 pb-6 pt-3"
      style={{ backgroundImage: `linear-gradient(180deg, ${colors.heroTop} 0%, ${colors.surface} 100%)` }}
    >
      <View className="flex-row items-center">
        <View className="flex-1 pr-2">
          <Text className="text-[15px] font-medium text-slate-500">{greeting()},</Text>
          <View className="mt-0.5 flex-row items-center gap-2">
            <Text className="shrink text-2xl font-extrabold tracking-tight text-ink" numberOfLines={1} maxFontSizeMultiplier={1.2}>
              {firstName}
            </Text>
            <MaterialCommunityIcons name="hand-wave" size={22} color={colors.accent} />
          </View>
        </View>
        {/* art sits in its own column, scaled down so it can never overlap the text */}
        <View style={{ width: 116, height: 124 }} className="items-center justify-center">
          <View style={{ transform: [{ scale: artScale }] }}>
            <HeroArt />
          </View>
        </View>
      </View>

      <Text className="mt-2 font-extrabold tracking-tight text-ink" style={head} maxFontSizeMultiplier={1.2}>{line1}</Text>
      <View className="flex-row flex-wrap items-end">
        <Text className="font-extrabold tracking-tight text-ink" style={head} maxFontSizeMultiplier={1.2}>{line2} </Text>
        <View>
          <Text className="font-extrabold tracking-tight text-brand-600" style={head} maxFontSizeMultiplier={1.2}>{highlight}</Text>
          <View
            className="absolute -bottom-1.5 left-0.5 right-2 h-2.5 rounded-full border-b-[3px] border-brand-500"
            style={{ transform: [{ rotate: '-2deg' }] }}
          />
        </View>
      </View>

      {children}
    </View>
  );
}
