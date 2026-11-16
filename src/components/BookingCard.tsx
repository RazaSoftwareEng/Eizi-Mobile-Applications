import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { Avatar, Card, ServiceIcon, type IconName } from '@/components/ui';
import { stageOf, type BookingRow, type Stage } from '@/lib/booking';
import { formatDateTime, formatPrice } from '@/lib/format';
import { hasCoords, openDirections, openInMaps, type Coords } from '@/lib/location';
import { colors } from '@/lib/theme';

const STAGE: Record<Stage, { label: string; box: string; text: string; dot: string }> = {
  searching: { label: 'Finding a worker', box: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  assigned: { label: 'Worker assigned', box: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500' },
  quote: { label: 'Price sent', box: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
  declined: { label: 'Price declined', box: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  working: { label: 'In progress', box: 'bg-brand-50', text: 'text-brand-800', dot: 'bg-brand-600' },
  completed: { label: 'Completed', box: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  cancelled: { label: 'Cancelled', box: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
};

export function StageBadge({ stage }: { stage: Stage }) {
  const s = STAGE[stage];
  return (
    <View className={`flex-row items-center gap-1.5 rounded-full px-2.5 py-1 ${s.box}`}>
      <View className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      <Text className={`text-xs font-semibold ${s.text}`}>{s.label}</Text>
    </View>
  );
}

/**
 * One booking, for either side. `viewer` decides the wording, which contact / map buttons show,
 * and `children` holds the stage-specific actions (approve price, send quote, rate …).
 */
export function BookingCard({ booking, viewer, children, banner }: {
  booking: BookingRow;
  viewer: 'customer' | 'provider';
  children?: ReactNode;
  /** Highlighted strip under the header (e.g. "Price waiting for your approval"). */
  banner?: ReactNode;
}) {
  const stage = stageOf(booking);
  const faded = stage === 'cancelled';
  const person = booking.person;
  const showContact = !!person && (stage === 'assigned' || stage === 'quote' || stage === 'declined' || stage === 'working');
  const price =
    stage === 'completed' || booking.quote_status === 'approved' ? Number(booking.total_price) : booking.quote_amount ?? null;

  return (
    <Card className="p-4" style={faded ? { opacity: 0.75 } : undefined}>
      {/* Header */}
      <View className="flex-row items-center gap-3">
        <ServiceIcon service={booking.service} tintId={booking.service_id} size={48} />
        <View className="flex-1">
          <Text className="text-base font-bold text-ink" numberOfLines={1}>
            {booking.service?.name}
          </Text>
          <Text className="mt-0.5 text-[13px] text-slate-500">Booking #{booking.id}</Text>
        </View>
        <StageBadge stage={stage} />
      </View>

      {banner}

      {/* Tasks */}
      <View className="mt-4 flex-row flex-wrap gap-1.5">
        {booking.tasks.map((t) => (
          <View key={t.id} className="flex-row items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1">
            <Ionicons name="checkmark" size={13} color={colors.brand} />
            <Text className="text-[12px] font-semibold text-brand-800">{t.name}</Text>
          </View>
        ))}
      </View>

      {/* Details */}
      <View className="mt-3 gap-3 rounded-2xl bg-surface p-3.5">
        <Row icon="calendar-outline" text={formatDateTime(booking.scheduled_at)} strong />
        <Row icon="location-outline" text={booking.address} />
        {booking.notes ? <Row icon="chatbox-ellipses-outline" text={booking.notes} /> : null}
        {booking.quote_note && booking.quote_status !== 'none' ? <Row icon="construct-outline" text={`Worker's note: ${booking.quote_note}`} /> : null}
      </View>

      {hasCoords(booking) && stage !== 'cancelled' ? (
        <MapActions coords={booking} viewer={viewer} active={stage !== 'completed'} />
      ) : null}

      {/* Person + price */}
      <View className="mt-4 flex-row items-center gap-3">
        {person ? (
          <>
            <Avatar name={person.full_name ?? ''} size={40} uri={person.avatar_url} />
            <View className="flex-1">
              <Text className="text-xs text-slate-500">{viewer === 'customer' ? 'Your worker' : 'Customer'}</Text>
              <Text className="text-[15px] font-semibold text-ink" numberOfLines={1}>
                {person.full_name || '—'}
              </Text>
              {viewer === 'customer' && person.rating_count ? (
                <View className="flex-row items-center gap-1">
                  <Ionicons name="star" size={12} color={colors.accent} />
                  <Text className="text-xs font-semibold text-slate-600">
                    {Number(person.rating_avg).toFixed(1)} · {person.rating_count} review{person.rating_count > 1 ? 's' : ''}
                  </Text>
                </View>
              ) : null}
            </View>
            {showContact && person.phone ? (
              <Pressable
                onPress={() => Linking.openURL(`tel:${person.phone}`)}
                accessibilityLabel={`Call ${person.full_name}`}
                className="h-10 w-10 items-center justify-center rounded-full bg-emerald-50 active:bg-emerald-100"
              >
                <Ionicons name="call" size={18} color={colors.success} />
              </Pressable>
            ) : null}
          </>
        ) : (
          <View className="flex-1 flex-row items-center gap-2">
            <Ionicons name="search" size={16} color={colors.muted} />
            <Text className="flex-1 text-[13px] text-slate-500">{stage === 'searching' ? 'Sent to nearby workers' : 'No worker'}</Text>
          </View>
        )}
        <View className="items-end">
          {price !== null ? (
            <>
              <Text className="text-lg font-bold text-ink">{formatPrice(price)}</Text>
              <Text className="text-[11px] text-slate-500">
                {stage === 'completed' ? 'Final price' : booking.quote_status === 'approved' ? 'Agreed price' : 'Quoted'}
              </Text>
            </>
          ) : (
            <>
              <Text className="text-lg font-bold text-ink">{formatPrice(booking.visit_fee)}</Text>
              <Text className="text-[11px] text-slate-500">Visiting fee</Text>
            </>
          )}
        </View>
      </View>

      <PaymentNote booking={booking} viewer={viewer} />

      {children ? <View className="mt-4 gap-2 border-t border-slate-100 pt-4">{children}</View> : null}
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

/** Worker: one tap to Google Maps navigation. Customer: check the pin they shared. */
function MapActions({ coords, viewer, active }: { coords: Coords; viewer: 'customer' | 'provider'; active: boolean }) {
  if (viewer === 'customer') {
    return (
      <Pressable onPress={() => openInMaps(coords)} className="mt-3 flex-row items-center gap-2 self-start rounded-xl bg-emerald-50 px-3 py-2 active:opacity-80">
        <Ionicons name="navigate" size={15} color={colors.success} />
        <Text className="text-[13px] font-semibold text-emerald-800">Location shared · View on map</Text>
      </Pressable>
    );
  }
  return (
    <View className="mt-3 flex-row gap-2">
      <Pressable
        onPress={() => openDirections(coords)}
        accessibilityRole="button"
        className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl py-2.5 active:opacity-80 ${active ? 'bg-brand-700' : 'bg-slate-100'}`}
      >
        <Ionicons name="navigate" size={17} color={active ? colors.white : colors.muted} />
        <Text className={`text-[14px] font-bold ${active ? 'text-white' : 'text-slate-600'}`}>Open in Google Maps</Text>
      </Pressable>
      <Pressable
        onPress={() => openInMaps(coords)}
        accessibilityRole="button"
        accessibilityLabel="Show pin on map"
        className="flex-row items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 active:bg-slate-50"
      >
        <Ionicons name="map-outline" size={17} color={colors.brand} />
      </Pressable>
    </View>
  );
}

/** One line explaining the money, worded for whoever is looking. */
function PaymentNote({ booking, viewer }: { booking: BookingRow; viewer: 'customer' | 'provider' }) {
  const stage = stageOf(booking);
  const total = formatPrice(booking.total_price);
  let icon: IconName = 'cash-outline';
  let cls = 'bg-slate-100';
  let fg: string = colors.muted;
  let text: string;

  if (booking.payment_method === 'wallet' && booking.payment_status === 'held') {
    icon = 'wallet';
    cls = 'bg-brand-50';
    fg = colors.brandDark;
    text = viewer === 'customer' ? `Paid ${total} from wallet · held safely until the job is done` : `Prepaid via wallet · ${total} reaches you when you mark it completed`;
  } else if (booking.payment_status === 'released') {
    icon = 'checkmark-circle';
    cls = 'bg-emerald-50';
    fg = colors.success;
    text = viewer === 'customer' ? `Paid ${total} from wallet` : `${total} added to your wallet`;
  } else if (booking.payment_status === 'refunded') {
    icon = 'arrow-undo';
    cls = 'bg-sky-50';
    fg = '#0369A1';
    text = viewer === 'customer' ? `${total} refunded to your wallet` : 'Wallet payment refunded to the customer';
  } else if (stage === 'completed') {
    text = viewer === 'customer' ? `Paid ${total} in cash` : `Collect ${total} in cash`;
  } else if (stage === 'declined') {
    text =
      viewer === 'customer'
        ? `You declined the price. Only the visiting fee ${formatPrice(booking.visit_fee)} applies if the worker leaves.`
        : `Customer declined. Send a new price, or complete for the visiting fee ${formatPrice(booking.visit_fee)}.`;
  } else if (stage === 'working') {
    text = viewer === 'customer' ? `Pay ${total} in cash after the job` : `Collect ${total} in cash after the job`;
  } else if (stage === 'cancelled') {
    return null;
  } else {
    text = `Visiting fee ${formatPrice(booking.visit_fee)} · adjusted against the final price agreed on site`;
  }

  return (
    <View className={`mt-3 flex-row items-center gap-2 rounded-xl px-3 py-2 ${cls}`}>
      <Ionicons name={icon} size={16} color={fg} />
      <Text className="flex-1 text-[13px] font-medium text-slate-700">{text}</Text>
    </View>
  );
}
