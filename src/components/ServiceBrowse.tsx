import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, Pressable, Text, View } from 'react-native';

import { ServiceIcon, serviceGlyph } from '@/components/ui';
import { formatPrice } from '@/lib/format';
import { colors, shadow, tintFor } from '@/lib/theme';
import type { Service } from '@/lib/types';

/** How many sub-services a category has (shown on the card). */
export type ServiceStat = { tasks: number };

/* ------------------------------------------------------------------ illustrated service card (2 per row) */

/**
 * Card with a soft colour blob holding the service illustration (uploaded from the admin portal —
 * a transparent 3D-style PNG works best). Until one is uploaded, the service icon sits on the blob.
 */
/** Width of one card in a 2-column grid, from the real screen width (works on every phone size). */
export const GRID_PADDING = 20;
export const GRID_GAP = 12;
export function cardWidthFor(screenWidth: number) {
  return Math.floor((screenWidth - GRID_PADDING * 2 - GRID_GAP) / 2);
}

export function ServiceCard({ service, stat, width, onPress }: { service: Service; stat?: ServiceStat; width: number; onPress: () => void }) {
  const tint = tintFor(service.id);

  // Everything scales from the card width so proportions hold on 320px phones and large ones alike.
  const pad = width < 160 ? 12 : 14;
  const inner = width - pad * 2;
  const artH = Math.round(inner * 0.62);
  const blobW = Math.round(inner * 0.78);
  const iconSize = Math.round(artH * 0.55);
  const compact = width < 170;

  return (
    <View style={{ width, marginBottom: GRID_GAP }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${service.name}, ${stat?.tasks ?? 0} services, visiting fee ${formatPrice(service.visit_fee)}`}
        className="flex-1 rounded-3xl bg-white active:opacity-90"
        style={[shadow.md, { padding: pad }]}
      >
        {/* Illustration on a soft blob */}
        <View style={{ height: artH, justifyContent: 'center' }}>
          <View
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: blobW,
              height: artH,
              backgroundColor: tint.bg,
              borderTopLeftRadius: artH * 0.5,
              borderTopRightRadius: artH * 0.6,
              borderBottomLeftRadius: artH * 0.45,
              borderBottomRightRadius: artH * 0.65,
            }}
          />
          {service.image_url ? (
            <Image
              source={{ uri: service.image_url }}
              style={{ width: blobW, height: artH }}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={{ width: blobW, height: artH, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name={serviceGlyph(service)} size={iconSize} color={tint.fg} />
            </View>
          )}
          <View className="absolute right-0 top-0 h-8 w-8 items-center justify-center rounded-full bg-brand-50">
            <Ionicons name="chevron-forward" size={17} color={colors.brandDark} />
          </View>
        </View>

        <Text
          className={`mt-2.5 font-bold tracking-tight text-ink ${compact ? 'text-[15px]' : 'text-[17px]'}`}
          numberOfLines={1}
          maxFontSizeMultiplier={1.3}
        >
          {service.name}
        </Text>
        <Text className="mt-0.5 text-[13px] text-slate-500" numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {stat?.tasks ? `${stat.tasks} services` : service.description}
        </Text>

        <View className="mt-3 flex-row items-center gap-1.5 self-start rounded-full bg-brand-50 px-2.5 py-1.5" style={{ maxWidth: '100%' }}>
          {!compact ? <MaterialCommunityIcons name="home-import-outline" size={14} color={colors.brand} /> : null}
          {/* shrinks to fit instead of truncating on narrow phones */}
          <Text
            className="shrink text-[12px] font-bold text-brand-800"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            maxFontSizeMultiplier={1.2}
          >
            {!compact ? <Text className="font-medium text-brand-600">Visit </Text> : null}
            {formatPrice(service.visit_fee)}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

/* ------------------------------------------------------------------ search result row */

export function ServiceRow({ service, stat, onPress }: { service: Service; stat?: ServiceStat; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="mx-5 mb-3 flex-row items-center gap-3 rounded-2xl bg-white p-3 active:bg-slate-50"
      style={shadow.sm}
    >
      {service.image_url ? (
        <View className="h-[52px] w-[52px] items-center justify-center rounded-2xl" style={{ backgroundColor: tintFor(service.id).bg }}>
          <Image source={{ uri: service.image_url }} style={{ width: 46, height: 46 }} resizeMode="contain" />
        </View>
      ) : (
        <ServiceIcon service={service} tintId={service.id} size={52} />
      )}
      <View className="flex-1">
        <Text className="text-base font-bold text-ink">{service.name}</Text>
        <Text className="text-[13px] text-slate-500" numberOfLines={1}>
          {stat?.tasks ? `${stat.tasks} services · visit ${formatPrice(service.visit_fee)}` : service.description}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.subtle} />
    </Pressable>
  );
}

/* ------------------------------------------------------------------ how it works */

const STEPS = [
  { icon: 'list' as const, title: 'Tick what you need', text: 'Choose a category and the exact jobs — e.g. Fan Fitting + Switchboard Repair.' },
  { icon: 'location' as const, title: 'Pin your location', text: 'Your request goes to verified workers nearby. The first to accept is on the way.' },
  { icon: 'pricetag' as const, title: 'Approve the price', text: 'The worker checks the job and sends a price. Work starts only when you approve.' },
  { icon: 'star' as const, title: 'Pay & rate', text: 'Pay cash or from your wallet when it is done, then rate your worker.' },
];

export function HowItWorks() {
  return (
    <View className="mx-5 rounded-3xl bg-white p-5" style={shadow.md}>
      <Text className="text-lg font-bold text-ink">How Eizi works</Text>
      <View className="mt-4 gap-4">
        {STEPS.map((s, i) => (
          <View key={s.title} className="flex-row gap-3">
            <View className="items-center">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-700">
                <Ionicons name={s.icon} size={18} color={colors.white} />
              </View>
              {i < STEPS.length - 1 ? <View className="mt-1 w-0.5 flex-1 rounded-full bg-brand-100" /> : null}
            </View>
            <View className="flex-1 pb-1">
              <Text className="text-[15px] font-bold text-ink">
                {i + 1}. {s.title}
              </Text>
              <Text className="mt-0.5 text-[13px] leading-5 text-slate-500">{s.text}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
