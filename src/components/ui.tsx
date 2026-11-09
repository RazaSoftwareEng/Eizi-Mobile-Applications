import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { formatPrice, initials } from '@/lib/format';
import { colors, shadow, tintFor } from '@/lib/theme';
import type { BookingStatus } from '@/lib/types';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** Sets the status bar text colour while a screen is focused (light on brand headers). */
export function useStatusBar(style: 'light' | 'dark') {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(style);
      return () => setStatusBarStyle('dark');
    }, [style]),
  );
}

/* ------------------------------------------------------------------ Card */

export function Card({ children, className = '', style, elevated = 'md' }: {
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  elevated?: 'sm' | 'md' | 'lg';
}) {
  return (
    <View className={`rounded-3xl bg-white ${className}`} style={[shadow[elevated], style]}>
      {children}
    </View>
  );
}

/* ---------------------------------------------------------------- Button */

type ButtonProps = {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'light';
  size?: 'lg' | 'md';
  icon?: IconName;
  className?: string;
};

const buttonStyles = {
  primary: { box: 'bg-brand-700', text: 'text-white', icon: colors.white, shadow: shadow.brand },
  secondary: { box: 'border border-line bg-white', text: 'text-ink', icon: colors.ink, shadow: shadow.sm },
  ghost: { box: 'bg-brand-50', text: 'text-brand-700', icon: colors.brandDark, shadow: undefined },
  danger: { box: 'bg-red-50', text: 'text-red-600', icon: colors.danger, shadow: undefined },
  light: { box: 'bg-white', text: 'text-brand-800', icon: colors.brandDark, shadow: shadow.md },
} as const;

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  size = 'lg',
  icon,
  className = '',
}: ButtonProps) {
  const s = buttonStyles[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      className={`flex-row items-center justify-center gap-2 rounded-2xl px-5 ${size === 'lg' ? 'h-14' : 'h-12'} ${s.box} ${className}`}
      style={({ pressed }) => [
        inactive ? undefined : s.shadow,
        { opacity: inactive ? 0.5 : pressed ? 0.85 : 1, transform: [{ scale: pressed && !inactive ? 0.98 : 1 }] },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={s.icon} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === 'lg' ? 20 : 18} color={s.icon} /> : null}
          <Text className={`font-semibold ${size === 'lg' ? 'text-base' : 'text-[15px]'} ${s.text}`}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

/* ----------------------------------------------------------------- Input */

type InputProps = TextInputProps & {
  label: string;
  icon?: IconName;
  hint?: string;
  prefix?: string;
  suffix?: string;
  className?: string;
};

export function Input({ label, icon, hint, prefix, suffix, className = '', secureTextEntry, multiline, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secureTextEntry);

  return (
    <View className={`gap-2 ${className}`}>
      <Text className="text-[13px] font-semibold text-slate-600">{label}</Text>
      <View
        className={`flex-row rounded-2xl border bg-white px-4 ${multiline ? 'min-h-24 items-start py-3' : 'h-14 items-center'} ${focused ? 'border-brand-500' : 'border-line'}`}
        style={focused ? { boxShadow: '0px 0px 0px 4px rgba(20, 145, 127, 0.12)' } : shadow.sm}
      >
        {icon ? (
          <Ionicons name={icon} size={20} color={focused ? colors.brand : colors.subtle} style={{ marginRight: 10 }} />
        ) : null}
        {prefix ? <Text className="mr-2 text-base font-semibold text-slate-500">{prefix}</Text> : null}
        <TextInput
          {...props}
          placeholderTextColor={colors.subtle}
          className="flex-1 text-base text-ink"
          style={multiline ? { textAlignVertical: 'top', minHeight: 72 } : undefined}
          secureTextEntry={hidden}
          multiline={multiline}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
        />
        {suffix ? <Text className="ml-2 text-base text-slate-500">{suffix}</Text> : null}
        {secureTextEntry ? (
          <Pressable
            hitSlop={8}
            onPress={() => setHidden((h) => !h)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            className="-mr-2 h-10 w-10 items-center justify-center rounded-full active:bg-slate-100"
          >
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={22} color={hidden ? colors.muted : colors.brand} />
          </Pressable>
        ) : null}
      </View>
      {hint ? <Text className="text-xs text-slate-500">{hint}</Text> : null}
    </View>
  );
}

/* --------------------------------------------------------------- Layout */

export function Loader() {
  return (
    <View className="flex-1 items-center justify-center bg-surface">
      <ActivityIndicator size="large" color={colors.brand} />
    </View>
  );
}

export function SectionTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View className="mb-3 flex-row items-end justify-between">
      <View className="flex-1">
        <Text className="text-lg font-bold text-ink">{title}</Text>
        {subtitle ? <Text className="mt-0.5 text-sm text-slate-500">{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View className="flex-row items-center justify-between px-5 pb-4 pt-3">
      <View className="flex-1">
        <Text className="text-[28px] font-bold tracking-tight text-ink">{title}</Text>
        {subtitle ? <Text className="mt-1 text-[15px] text-slate-500">{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function EmptyState({ icon, title, subtitle, children }: {
  icon: IconName;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <View className="items-center justify-center px-8 py-14">
      <View className="mb-5 h-20 w-20 items-center justify-center rounded-full bg-white" style={shadow.md}>
        <View className="h-14 w-14 items-center justify-center rounded-full bg-brand-50">
          <Ionicons name={icon} size={28} color={colors.brand} />
        </View>
      </View>
      <Text className="text-center text-lg font-bold text-ink">{title}</Text>
      {subtitle ? <Text className="mt-2 text-center leading-5 text-slate-500">{subtitle}</Text> : null}
      {children ? <View className="mt-6 w-full">{children}</View> : null}
    </View>
  );
}

/* --------------------------------------------------------------- Pieces */

export function Avatar({ name, size = 48, light }: { name: string; size?: number; light?: boolean }) {
  return (
    <View
      className={`items-center justify-center rounded-full ${light ? 'bg-white/20' : 'bg-brand-50'}`}
      style={{ width: size, height: size }}
    >
      <Text className={`font-bold ${light ? 'text-white' : 'text-brand-700'}`} style={{ fontSize: size * 0.36 }}>
        {initials(name)}
      </Text>
    </View>
  );
}

type ServiceGlyph = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Professional line icons for each service category (matched by name, so emoji values in the DB are ignored). */
const SERVICE_ICONS: Record<string, ServiceGlyph> = {
  dishwasher: 'dishwasher',
  cook: 'chef-hat',
  electrician: 'flash',
  plumber: 'pipe-wrench',
  'house cleaner': 'broom',
  cleaner: 'broom',
  carpenter: 'saw-blade',
  painter: 'format-paint',
  'ac technician': 'air-conditioner',
  laundry: 'washing-machine',
  babysitter: 'baby-face-outline',
  driver: 'car-outline',
  gardener: 'flower-outline',
};

export function serviceGlyph(service: { name?: string | null; icon?: string | null } | null | undefined): ServiceGlyph {
  const stored = service?.icon ?? '';
  if (stored in MaterialCommunityIcons.glyphMap) return stored as ServiceGlyph;
  return SERVICE_ICONS[(service?.name ?? '').trim().toLowerCase()] ?? 'toolbox-outline';
}

/** Rounded, colour-tinted tile with the service's icon. */
export function ServiceIcon({ service, tintId, size = 52, onColor }: {
  service: { name?: string | null; icon?: string | null } | null | undefined;
  tintId: number;
  size?: number;
  /** Draw on a white tile (for use on top of a tinted background). */
  onColor?: boolean;
}) {
  const tint = tintFor(tintId);
  return (
    <View
      className="items-center justify-center rounded-2xl"
      style={{ width: size, height: size, backgroundColor: onColor ? colors.white : tint.bg }}
    >
      <MaterialCommunityIcons name={serviceGlyph(service)} size={Math.round(size * 0.5)} color={tint.fg} />
    </View>
  );
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      className="flex-row items-center gap-2.5"
    >
      <View
        className={`h-[22px] w-[22px] items-center justify-center rounded-md border-2 ${checked ? 'border-brand-700 bg-brand-700' : 'border-slate-300 bg-white'}`}
      >
        {checked ? <Ionicons name="checkmark" size={15} color={colors.white} /> : null}
      </View>
      <Text className="text-[14px] font-medium text-slate-700">{label}</Text>
    </Pressable>
  );
}

const statusStyles: Record<BookingStatus, { box: string; text: string; dot: string; label: string }> = {
  pending: { box: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Pending' },
  accepted: { box: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500', label: 'Confirmed' },
  rejected: { box: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', label: 'Declined' },
  completed: { box: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Completed' },
  cancelled: { box: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', label: 'Cancelled' },
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  const s = statusStyles[status];
  return (
    <View className={`flex-row items-center gap-1.5 rounded-full px-2.5 py-1 ${s.box}`}>
      <View className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      <Text className={`text-xs font-semibold ${s.text}`}>{s.label}</Text>
    </View>
  );
}

export function Chip({ label, sublabel, selected, onPress, disabled }: {
  label: string;
  sublabel?: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      className={`items-center justify-center rounded-2xl border px-4 py-3 ${selected ? 'border-brand-700 bg-brand-700' : 'border-line bg-white'} ${disabled ? 'opacity-40' : ''}`}
      style={selected ? shadow.brand : shadow.sm}
    >
      {sublabel ? (
        <Text className={`text-xs font-medium ${selected ? 'text-brand-100' : 'text-slate-500'}`}>{sublabel}</Text>
      ) : null}
      <Text className={`text-center text-[15px] font-semibold ${selected ? 'text-white' : 'text-ink'}`}>{label}</Text>
    </Pressable>
  );
}

/** iOS-style segmented control for filters. */
export function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex-row rounded-2xl bg-slate-200/70 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className={`h-10 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl ${active ? 'bg-white' : ''}`}
            style={active ? shadow.sm : undefined}
          >
            <Text className={`text-sm font-semibold ${active ? 'text-ink' : 'text-slate-500'}`}>{o.label}</Text>
            {o.count ? (
              <View className={`min-w-5 items-center rounded-full px-1.5 ${active ? 'bg-brand-700' : 'bg-slate-300'}`}>
                <Text className={`text-[11px] font-bold ${active ? 'text-white' : 'text-slate-600'}`}>{o.count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function PriceRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <View className="flex-row items-center justify-between py-1.5">
      <Text className={bold ? 'text-base font-bold text-ink' : 'text-[15px] text-slate-500'}>{label}</Text>
      <Text className={bold ? 'text-xl font-bold text-brand-700' : 'text-[15px] font-semibold text-ink'}>{formatPrice(value)}</Text>
    </View>
  );
}

export function ListRow({ icon, label, onPress, danger, right }: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  danger?: boolean;
  right?: ReactNode;
}) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-3 px-4 py-4 active:bg-slate-50">
      <View className={`h-10 w-10 items-center justify-center rounded-xl ${danger ? 'bg-red-50' : 'bg-brand-50'}`}>
        <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.brand} />
      </View>
      <Text className={`flex-1 text-[15px] font-semibold ${danger ? 'text-red-600' : 'text-ink'}`}>{label}</Text>
      {right ?? <Ionicons name="chevron-forward" size={18} color={colors.subtle} />}
    </Pressable>
  );
}
