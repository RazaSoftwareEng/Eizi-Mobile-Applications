import type { ViewStyle } from 'react-native';

/** Raw colour values for places Tailwind classes can't reach (icons, native props). Keep in sync with tailwind.config.js. */
export const colors = {
  brand: '#0E7A6B',
  brandDark: '#0B6358',
  brandDeep: '#083B36',
  brandSoft: '#EEF9F7',
  accent: '#F59E0B',
  accentDark: '#B45309',
  ink: '#0F172A',
  body: '#334155',
  muted: '#64748B',
  subtle: '#94A3B8',
  line: '#E2E8F0',
  surface: '#F5F7FA',
  /** Top of the customer-home hero gradient; the app bar uses it on that screen so both read as one surface. */
  heroTop: '#E6F6F2',
  white: '#FFFFFF',
  danger: '#DC2626',
  success: '#16A34A',
} as const;

/** Soft, layered shadows (CSS box-shadow syntax, supported natively by React Native's new architecture). */
export const shadow = {
  sm: { boxShadow: '0px 1px 2px rgba(15, 23, 42, 0.04), 0px 1px 3px rgba(15, 23, 42, 0.06)' },
  md: { boxShadow: '0px 2px 4px rgba(15, 23, 42, 0.03), 0px 8px 20px rgba(15, 23, 42, 0.07)' },
  lg: { boxShadow: '0px 4px 8px rgba(15, 23, 42, 0.04), 0px 16px 36px rgba(15, 23, 42, 0.12)' },
  brand: { boxShadow: '0px 8px 20px rgba(11, 99, 88, 0.30)' },
  top: { boxShadow: '0px -6px 20px rgba(15, 23, 42, 0.06)' },
} satisfies Record<string, ViewStyle>;

/** Pastel tiles so every service category is easy to tell apart at a glance. */
const tints = [
  { bg: '#E6F6F2', fg: '#0B6358' },
  { bg: '#FFF3E0', fg: '#B45309' },
  { bg: '#EEF2FF', fg: '#4338CA' },
  { bg: '#FDECF2', fg: '#BE185D' },
  { bg: '#E7F3FE', fg: '#1D4ED8' },
  { bg: '#F3EEFD', fg: '#6D28D9' },
] as const;

export function tintFor(id: number) {
  return tints[Math.abs(id) % tints.length];
}
