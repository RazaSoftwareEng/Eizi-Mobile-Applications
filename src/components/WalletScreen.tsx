import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import { Button, Card, EmptyState, Loader } from '@/components/ui';
import { formatDateTime, formatPrice } from '@/lib/format';
import { colors, shadow } from '@/lib/theme';
import { fetchWallet, METHOD_STYLE, TX_META, type WalletRequest, type WalletTx } from '@/lib/wallet';
import { useAuth } from '@/providers/AuthProvider';

export function WalletScreen() {
  const { session, profile } = useAuth();
  const isProvider = profile?.role === 'provider';
  const [data, setData] = useState<{ balance: number; transactions: WalletTx[]; requests: WalletRequest[] } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (session) setData(await fetchWallet(session.user.id));
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!data) return <Loader />;

  const pending = data.requests.filter((r) => r.status === 'pending');
  const pendingTopup = pending.filter((r) => r.kind === 'topup').reduce((s, r) => s + Number(r.amount), 0);
  const pendingWithdraw = pending.filter((r) => r.kind === 'withdraw').reduce((s, r) => s + Number(r.amount), 0);
  const recentlyReviewed = data.requests.filter((r) => r.status !== 'pending').slice(0, 3);

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="gap-5 px-5 pb-12 pt-2"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.brand}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      {/* Balance card */}
      <View
        className="overflow-hidden rounded-3xl p-6"
        style={[shadow.lg, { backgroundImage: 'linear-gradient(135deg, #0B6358 0%, #14917F 100%)' }]}
      >
        <View className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10" />
        <View className="absolute -bottom-16 -left-8 h-36 w-36 rounded-full bg-white/5" />
        <View className="flex-row items-center gap-2">
          <Ionicons name="wallet" size={18} color={colors.white} />
          <Text className="text-sm font-semibold text-brand-100">Eizi Wallet · available balance</Text>
        </View>
        <Text className="mt-2 text-[38px] font-extrabold tracking-tight text-white" maxFontSizeMultiplier={1.2}>
          {formatPrice(data.balance)}
        </Text>
        {pendingTopup ? (
          <Text className="mt-1 text-[13px] text-brand-100">+ {formatPrice(pendingTopup)} waiting for verification</Text>
        ) : null}
        {pendingWithdraw ? (
          <Text className="mt-1 text-[13px] text-brand-100">{formatPrice(pendingWithdraw)} withdrawal being processed</Text>
        ) : null}

        <View className="mt-5 flex-row gap-3">
          {isProvider ? (
            <Button
              title="Withdraw"
              icon="arrow-up-circle-outline"
              variant="light"
              className="flex-1"
              disabled={data.balance < 500}
              onPress={() => router.push('/wallet/withdraw')}
            />
          ) : (
            <Button title="Add money" icon="add-circle-outline" variant="light" className="flex-1" onPress={() => router.push('/wallet/add')} />
          )}
        </View>
        {isProvider && data.balance < 500 ? (
          <Text className="mt-2 text-center text-xs text-brand-100">Withdraw from Rs 500 · earnings arrive when a wallet-paid job is completed</Text>
        ) : null}
      </View>

      {/* How it works (customer) */}
      {!isProvider ? (
        <Card className="flex-row items-start gap-3 p-4" elevated="sm">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
            <Ionicons name="shield-checkmark" size={20} color={colors.brand} />
          </View>
          <Text className="flex-1 text-[13px] leading-5 text-slate-600">
            Pay for bookings from your wallet. The amount is held safely and only goes to the pro after the job is completed —
            cancelled or declined bookings are refunded to your wallet instantly.
          </Text>
        </Card>
      ) : null}

      {/* Pending + recently reviewed requests */}
      {pending.length || recentlyReviewed.length ? (
        <View>
          <Text className="mb-3 text-lg font-bold text-ink">Requests</Text>
          <Card className="py-1">
            {[...pending, ...recentlyReviewed].map((r, i) => (
              <RequestRow key={r.id} r={r} divider={i > 0} />
            ))}
          </Card>
        </View>
      ) : null}

      {/* History */}
      <View>
        <Text className="mb-3 text-lg font-bold text-ink">History</Text>
        {data.transactions.length === 0 ? (
          <Card>
            <EmptyState
              icon="receipt-outline"
              title="No transactions yet"
              subtitle={isProvider ? 'Earnings from wallet-paid jobs will show here.' : 'Add money to pay for bookings in one tap.'}
            />
          </Card>
        ) : (
          <Card className="py-1">
            {data.transactions.map((t, i) => (
              <TxRow key={t.id} t={t} divider={i > 0} />
            ))}
          </Card>
        )}
      </View>
    </ScrollView>
  );
}

function TxRow({ t, divider }: { t: WalletTx; divider: boolean }) {
  const meta = TX_META[t.type];
  const amount = Number(t.amount);
  const credit = amount > 0;
  return (
    <View className={`flex-row items-center gap-3 px-4 py-3.5 ${divider ? 'border-t border-slate-100' : ''}`}>
      <View className={`h-10 w-10 items-center justify-center rounded-full ${credit ? 'bg-emerald-50' : 'bg-slate-100'}`}>
        <Ionicons name={meta.icon} size={20} color={credit ? colors.success : colors.muted} />
      </View>
      <View className="flex-1">
        <Text className="text-[15px] font-semibold text-ink">{meta.label}</Text>
        <Text className="text-xs text-slate-500" numberOfLines={1}>
          {t.note ? `${t.note} · ` : ''}
          {formatDateTime(t.created_at)}
        </Text>
      </View>
      <Text className={`text-[15px] font-bold ${credit ? 'text-emerald-700' : 'text-ink'}`}>
        {credit ? '+' : '−'} {formatPrice(Math.abs(amount))}
      </Text>
    </View>
  );
}

const REQ_STATUS = {
  pending: { label: 'Verifying', cls: 'bg-amber-50', text: 'text-amber-700' },
  approved: { label: 'Approved', cls: 'bg-emerald-50', text: 'text-emerald-700' },
  rejected: { label: 'Declined', cls: 'bg-red-50', text: 'text-red-700' },
} as const;

function RequestRow({ r, divider }: { r: WalletRequest; divider: boolean }) {
  const m = METHOD_STYLE[r.method];
  const st = REQ_STATUS[r.status];
  const title = r.kind === 'topup' ? 'Add money' : 'Withdrawal';
  const label = r.kind === 'withdraw' && r.status === 'approved' ? 'Paid' : st.label;
  return (
    <View className={`flex-row items-center gap-3 px-4 py-3.5 ${divider ? 'border-t border-slate-100' : ''}`}>
      <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: m.bg }}>
        <Text className="text-xs font-extrabold" style={{ color: m.fg }}>
          {m.initials}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="text-[15px] font-semibold text-ink">
          {title} · {formatPrice(r.amount)}
        </Text>
        <Text className="text-xs text-slate-500" numberOfLines={2}>
          {r.kind === 'topup' ? `TID ${r.reference}` : `To ${r.account_number}`} · {formatDateTime(r.created_at)}
          {r.status === 'rejected' && r.admin_note ? `\nReason: ${r.admin_note}` : ''}
        </Text>
      </View>
      <View className={`rounded-full px-2.5 py-1 ${st.cls}`}>
        <Text className={`text-xs font-semibold ${st.text}`}>{label}</Text>
      </View>
    </View>
  );
}
