import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { Avatar, Card, ServiceIcon, StatusBadge, type IconName } from '@/components/ui';
import { formatDateTime, formatPrice } from '@/lib/format';
import { colors } from '@/lib/theme';
import type { BookingStatus } from '@/lib/types';

export type BookingRow = {
  id: number;
  service_id: number;
  hours: number;
  hourly_rate: number;
  total_price: number;
  scheduled_at: string;
  address: string;
  notes: string;
  status: BookingStatus;
  payment_method: 'cash' | 'wallet';
  payment_status: 'unpaid' | 'held' | 'released' | 'refunded';
  service: { name: string; icon: string } | null;
  /** The other party: provider for customers, customer for providers. */
  person: { full_name: string; phone: string | null; avatar_url?: string | null } | null;
};

export const BOOKING_SELECT =
  'id, service_id, hours, hourly_rate, total_price, scheduled_at, address, notes, status, payment_method, payment_status, service:services(name, icon)';

export function BookingCard({ booking, personLabel, showPhone, actions }: {
  booking: BookingRow;
  personLabel: string;
  showPhone: boolean;
  actions?: ReactNode;
}) {
  const phone = booking.person?.phone;
  const faded = booking.status === 'cancelled' || booking.status === 'rejected';

  return (
    <Card className="p-4" style={faded ? { opacity: 0.75 } : undefined}>
      {/* Header */}
      <View className="flex-row items-center gap-3">
        <ServiceIcon service={booking.service} tintId={booking.service_id} size={48} />
        <View className="flex-1">
          <Text className="text-base font-bold text-ink">{booking.service?.name}</Text>
          <Text className="mt-0.5 text-[13px] text-slate-500">Booking #{booking.id}</Text>
        </View>
        <StatusBadge status={booking.status} />
      </View>

      {/* Details */}
      <View className="mt-4 gap-3 rounded-2xl bg-surface p-3.5">
        <Row icon="calendar-outline" text={formatDateTime(booking.scheduled_at)} strong />
        <Row icon="time-outline" text={`${booking.hours} hour${booking.hours > 1 ? 's' : ''}`} />
        <Row icon="location-outline" text={booking.address} />
        {booking.notes ? <Row icon="chatbox-ellipses-outline" text={booking.notes} /> : null}
      </View>

      <PaymentNote booking={booking} viewer={personLabel === 'Customer' ? 'provider' : 'customer'} />

      {/* Person + price */}
      <View className="mt-4 flex-row items-center gap-3">
        <Avatar name={booking.person?.full_name ?? ''} size={40} uri={booking.person?.avatar_url} />
        <View className="flex-1">
          <Text className="text-xs text-slate-500">{personLabel}</Text>
          <Text className="text-[15px] font-semibold text-ink" numberOfLines={1}>
            {booking.person?.full_name || '—'}
          </Text>
        </View>
        {showPhone && phone ? (
          <Pressable
            onPress={() => Linking.openURL(`tel:${phone}`)}
            accessibilityLabel={`Call ${booking.person?.full_name ?? ''}`}
            className="h-10 w-10 items-center justify-center rounded-full bg-emerald-50 active:bg-emerald-100"
          >
            <Ionicons name="call" size={18} color={colors.success} />
          </Pressable>
        ) : null}
        <View className="items-end">
          <Text className="text-lg font-bold text-ink">{formatPrice(booking.total_price)}</Text>
          <Text className="text-[11px] text-slate-500">
            {formatPrice(booking.hourly_rate)} × {booking.hours}
          </Text>
        </View>
      </View>

      {actions ? <View className="mt-4 flex-row gap-2 border-t border-slate-100 pt-4">{actions}</View> : null}
    </Card>
  );
}

function Row({ icon, text, strong }: { icon: IconName; text: string; strong?: boolean }) {
  return (
    <View className="flex-row items-start gap-2.5">
      <Ionicons name={icon} size={17} color={colors.brand} style={{ marginTop: 1 }} />
      <Text className={`flex-1 text-[14px] leading-5 ${strong ? 'font-semibold text-ink' : 'text-slate-600'}`}>{text}</Text>
    </View>
  );
}

const PAY: Record<string, { icon: 'wallet' | 'checkmark-circle' | 'arrow-undo' | 'cash-outline'; cls: string; fg: string }> = {
  held: { icon: 'wallet', cls: 'bg-brand-50', fg: colors.brandDark },
  released: { icon: 'checkmark-circle', cls: 'bg-emerald-50', fg: colors.success },
  refunded: { icon: 'arrow-undo', cls: 'bg-sky-50', fg: '#0369A1' },
  cash: { icon: 'cash-outline', cls: 'bg-slate-100', fg: colors.muted },
};

/** One line explaining where the money is, worded for whoever is looking. */
function PaymentNote({ booking, viewer }: { booking: BookingRow; viewer: 'customer' | 'provider' }) {
  const total = formatPrice(booking.total_price);
  let key = 'cash';
  let text = viewer === 'customer' ? 'Pay cash after the job' : 'Customer pays cash after the job';
  if (booking.payment_method === 'wallet') {
    key = booking.payment_status;
    if (booking.payment_status === 'held')
      text =
        viewer === 'customer'
          ? `Paid ${total} from wallet · held until the job is done`
          : `Prepaid via wallet · ${total} reaches your wallet when you mark it completed`;
    else if (booking.payment_status === 'released')
      text = viewer === 'customer' ? `Paid ${total} from wallet` : `${total} added to your wallet`;
    else if (booking.payment_status === 'refunded')
      text = viewer === 'customer' ? `${total} refunded to your wallet` : 'Wallet payment refunded to the customer';
  }
  const p = PAY[key] ?? PAY.cash;
  return (
    <View className={`mt-3 flex-row items-center gap-2 rounded-xl px-3 py-2 ${p.cls}`}>
      <Ionicons name={p.icon} size={16} color={p.fg} />
      <Text className="flex-1 text-[13px] font-medium text-slate-700">{text}</Text>
    </View>
  );
}
