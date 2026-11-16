import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Button, Input } from '@/components/ui';
import { tasksText, type BookingRow } from '@/lib/booking';
import { formatPrice } from '@/lib/format';
import { colors, shadow } from '@/lib/theme';
import type { PayMethod } from '@/lib/types';

/** Bottom sheet shell used by the pop-ups below. */
function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-black/40" onPress={onClose} accessibilityLabel="Close" />
        <View className="rounded-t-[28px] bg-white px-5 pt-3" style={[shadow.lg, { paddingBottom: insets.bottom + 16 }]}>
          <View className="mb-4 h-1.5 w-12 self-center rounded-full bg-slate-200" />
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ------------------------------------------------------------------ customer: approve / decline the price */

export function QuoteSheet({ booking, balance, onClose, onRespond, busy, onAddMoney }: {
  booking: BookingRow | null;
  balance: number | null;
  onClose: () => void;
  onRespond: (approve: boolean, pay: PayMethod) => void;
  busy: boolean;
  onAddMoney: () => void;
}) {
  const [pay, setPay] = useState<PayMethod>('cash');
  if (!booking) return null;
  const amount = Number(booking.quote_amount ?? 0);
  const short = balance !== null && balance < amount;
  const method: PayMethod = pay === 'wallet' && short ? 'cash' : pay;

  return (
    <Sheet visible onClose={onClose}>
      <View className="flex-row items-center gap-3">
        <Avatar name={booking.person?.full_name ?? ''} size={44} uri={booking.person?.avatar_url} />
        <View className="flex-1">
          <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400">Price from your worker</Text>
          <Text className="text-[15px] font-bold text-ink" numberOfLines={1}>
            {booking.person?.full_name}
          </Text>
        </View>
      </View>

      <View className="mt-4 items-center rounded-3xl bg-brand-50 py-5">
        <Text className="text-[13px] font-medium text-brand-700">{tasksText(booking.tasks, 2)}</Text>
        <Text className="mt-1 text-4xl font-extrabold text-ink">{formatPrice(amount)}</Text>
        <Text className="mt-1 text-xs text-slate-500">Includes the visiting fee {formatPrice(booking.visit_fee)}</Text>
      </View>
      {booking.quote_note ? (
        <View className="mt-3 flex-row items-start gap-2 rounded-2xl bg-surface p-3">
          <Ionicons name="construct-outline" size={16} color={colors.brand} style={{ marginTop: 2 }} />
          <Text className="flex-1 text-[13px] leading-5 text-slate-700">{booking.quote_note}</Text>
        </View>
      ) : null}

      <Text className="mb-2 mt-4 text-[13px] font-semibold text-slate-600">How will you pay?</Text>
      <View className="flex-row gap-2">
        <PayPick icon="cash-outline" title="Cash" subtitle="After the job" selected={method === 'cash'} onPress={() => setPay('cash')} />
        <PayPick
          icon="wallet-outline"
          title="Wallet"
          subtitle={balance === null ? 'Checking…' : short ? `Only ${formatPrice(balance)}` : `${formatPrice(balance)} available`}
          selected={method === 'wallet'}
          disabled={short || balance === null}
          onPress={() => setPay('wallet')}
        />
      </View>
      {short ? (
        <Pressable onPress={onAddMoney} className="mt-2 self-start rounded-lg px-1 py-1 active:opacity-70">
          <Text className="text-[13px] font-bold text-brand-700">Add money to wallet</Text>
        </Pressable>
      ) : null}
      <Text className="mt-2 text-xs leading-5 text-slate-500">
        {method === 'wallet'
          ? 'Paid now from your wallet and held safely by Eizi. The worker gets it only after you both finish the job.'
          : 'Pay the worker in cash when the work is done.'}
      </Text>

      <View className="mt-5 flex-row gap-3">
        <View className="flex-1">
          <Button title="Decline" variant="secondary" onPress={() => onRespond(false, method)} disabled={busy} />
        </View>
        <View className="flex-[1.6]">
          <Button title="Approve price" icon="checkmark-circle" onPress={() => onRespond(true, method)} loading={busy} />
        </View>
      </View>
    </Sheet>
  );
}

function PayPick({ icon, title, subtitle, selected, disabled, onPress }: {
  icon: 'cash-outline' | 'wallet-outline';
  title: string;
  subtitle: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      className={`flex-1 flex-row items-center gap-2.5 rounded-2xl border-2 p-3 ${selected ? 'border-brand-600 bg-brand-50' : 'border-line bg-white'} ${disabled ? 'opacity-50' : ''}`}
    >
      <Ionicons name={icon} size={22} color={selected ? colors.brand : colors.muted} />
      <View className="flex-1">
        <Text className="text-[14px] font-bold text-ink">{title}</Text>
        <Text className="text-[11px] text-slate-500" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ worker: send the price */

export function SendQuoteSheet({ booking, onClose, onSend, busy }: {
  booking: BookingRow | null;
  onClose: () => void;
  onSend: (amount: number, note: string) => void;
  busy: boolean;
}) {
  const [amount, setAmount] = useState(booking?.quote_amount ? String(Math.round(booking.quote_amount)) : '');
  const [note, setNote] = useState(booking?.quote_note ?? '');
  if (!booking) return null;
  const value = Number(amount.replace(/[^\d]/g, ''));
  const tooLow = !!amount && value < Number(booking.visit_fee);

  return (
    <Sheet visible onClose={onClose}>
      <Text className="text-lg font-bold text-ink">Send your price</Text>
      <Text className="mt-1 text-[13px] leading-5 text-slate-500">
        For {tasksText(booking.tasks, 3)}. The customer approves it before you start. Minimum is the visiting fee{' '}
        {formatPrice(booking.visit_fee)}.
      </Text>
      <View className="mt-4 flex-row items-center rounded-2xl border-2 border-brand-600 bg-white px-4" style={shadow.sm}>
        <Text className="mr-2 text-2xl font-bold text-slate-400">Rs</Text>
        <TextInput
          value={amount}
          onChangeText={(t) => setAmount(t.replace(/[^\d]/g, '').slice(0, 7))}
          keyboardType="number-pad"
          placeholder={String(Math.round(booking.visit_fee))}
          placeholderTextColor={colors.subtle}
          className="h-16 flex-1 text-3xl font-extrabold text-ink"
          autoFocus
          accessibilityLabel="Final price in rupees"
        />
      </View>
      {tooLow ? <Text className="mt-1.5 text-xs font-semibold text-red-600">At least {formatPrice(booking.visit_fee)}</Text> : null}
      <Input
        className="mt-4"
        label="What's included (optional)"
        placeholder="e.g. Fan capacitor + 2 sockets, parts included"
        value={note}
        onChangeText={setNote}
        multiline
      />
      <Button
        className="mt-5"
        title={value ? `Send ${formatPrice(value)}` : 'Enter the price'}
        icon="paper-plane"
        disabled={!value || tooLow}
        loading={busy}
        onPress={() => onSend(value, note.trim())}
      />
    </Sheet>
  );
}

/* ------------------------------------------------------------------ customer: rate the worker */

export function RateSheet({ booking, onClose, onRate, busy }: {
  booking: BookingRow | null;
  onClose: () => void;
  onRate: (stars: number, review: string) => void;
  busy: boolean;
}) {
  const [stars, setStars] = useState(0);
  const [review, setReview] = useState('');
  if (!booking) return null;
  const LABELS = ['', 'Poor', 'Could be better', 'Good', 'Very good', 'Excellent'];

  return (
    <Sheet visible onClose={onClose}>
      <View className="items-center">
        <Avatar name={booking.person?.full_name ?? ''} size={64} uri={booking.person?.avatar_url} />
        <Text className="mt-3 text-lg font-bold text-ink">How was {booking.person?.full_name?.split(' ')[0] ?? 'your worker'}?</Text>
        <Text className="text-[13px] text-slate-500">Your rating helps other families choose.</Text>
        <View className="mt-4 flex-row gap-2" accessibilityRole="radiogroup">
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => setStars(n)} hitSlop={6} accessibilityRole="radio" accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`} accessibilityState={{ checked: stars === n }}>
              <Ionicons name={n <= stars ? 'star' : 'star-outline'} size={40} color={n <= stars ? colors.accent : colors.line} />
            </Pressable>
          ))}
        </View>
        <Text className="mt-2 h-5 text-[13px] font-semibold text-accent-700">{LABELS[stars]}</Text>
      </View>
      <Input className="mt-3" label="Add a comment (optional)" placeholder="What went well?" value={review} onChangeText={setReview} multiline />
      <Button className="mt-5" title="Submit rating" icon="star" disabled={!stars} loading={busy} onPress={() => onRate(stars, review.trim())} />
    </Sheet>
  );
}
