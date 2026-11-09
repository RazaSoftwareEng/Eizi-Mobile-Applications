import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Chip, Input, Loader } from '@/components/ui';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { colors, shadow } from '@/lib/theme';
import { fetchPaymentAccounts, METHOD_STYLE, type PaymentAccount, type PayMethod } from '@/lib/wallet';

const QUICK = [500, 1000, 2000, 5000];

export default function AddMoney() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tileW = Math.floor((width - 40 - 40 - 12) / 2); // screen − page padding − card padding − gap

  const [accounts, setAccounts] = useState<PaymentAccount[] | null>(null);
  const [method, setMethod] = useState<PayMethod | null>(null);
  const [amount, setAmount] = useState('');
  const [tid, setTid] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchPaymentAccounts().then(setAccounts);
  }, []);

  if (!accounts) return <Loader />;

  const selected = accounts.find((a) => a.method === method) ?? null;
  const value = Number(amount);
  const ready = !!selected && value >= 100 && value <= 50000 && tid.trim().length >= 6;

  async function copy() {
    if (!selected) return;
    await Clipboard.setStringAsync(selected.account_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function submit() {
    if (!selected) return;
    setBusy(true);
    const { error } = await supabase.rpc('request_topup', { p_method: selected.method, p_amount: value, p_reference: tid.trim() });
    setBusy(false);
    if (error) {
      Alert.alert('Could not submit', error.message);
      return;
    }
    Alert.alert(
      'Request submitted',
      `We'll verify your ${selected.label} payment of ${formatPrice(value)} and add it to your wallet shortly.`,
      [{ text: 'OK', onPress: () => router.back() }],
    );
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-surface" behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerClassName="gap-4 px-5 pb-8 pt-1" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Online — coming soon */}
        <Card className="flex-row items-center gap-3 p-4 opacity-70" elevated="sm">
          <View className="h-11 w-11 items-center justify-center rounded-xl bg-slate-100">
            <Ionicons name="card-outline" size={22} color={colors.muted} />
          </View>
          <View className="flex-1">
            <Text className="text-[15px] font-bold text-ink">Pay online</Text>
            <Text className="text-xs text-slate-500">Debit / credit card & bank transfer</Text>
          </View>
          <View className="rounded-full bg-violet-50 px-2.5 py-1">
            <Text className="text-xs font-bold text-violet-700">Coming soon</Text>
          </View>
        </Card>

        {/* Manual methods */}
        <Card className="p-5">
          <Text className="text-base font-bold text-ink">Pay manually</Text>
          <Text className="mb-4 mt-0.5 text-[13px] text-slate-500">Send money from your mobile wallet, then tell us the transaction ID.</Text>
          <View className="flex-row flex-wrap" style={{ gap: 12 }}>
            {accounts.map((a) => {
              const m = METHOD_STYLE[a.method];
              const available = a.is_active && !!a.account_number;
              const active = method === a.method;
              return (
                <Pressable
                  key={a.method}
                  disabled={!available}
                  onPress={() => setMethod(a.method)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active, disabled: !available }}
                  className={`flex-row items-center gap-2.5 rounded-2xl border-2 p-3 ${active ? 'border-brand-600 bg-brand-50' : 'border-line bg-white'}`}
                  style={[{ width: tileW, opacity: available ? 1 : 0.45 }, active ? shadow.sm : undefined]}
                >
                  <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: m.bg }}>
                    <Text className="text-[13px] font-extrabold" style={{ color: m.fg }}>
                      {m.initials}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-[14px] font-bold text-ink" numberOfLines={1}>
                      {a.label}
                    </Text>
                    <Text className="text-[11px] text-slate-500">{available ? 'Manual' : 'Not available'}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {selected ? (
          <>
            {/* Where to send */}
            <Card className="p-5">
              <Text className="mb-3 text-base font-bold text-ink">1. Send money to Eizi</Text>
              <View className="rounded-2xl bg-surface p-4">
                <Text className="text-xs font-semibold uppercase tracking-wider text-slate-500">{selected.label} account</Text>
                <View className="mt-1 flex-row items-center justify-between gap-3">
                  <Text className="flex-1 text-xl font-extrabold tracking-wide text-ink" selectable>
                    {selected.account_number}
                  </Text>
                  <Pressable
                    onPress={copy}
                    accessibilityLabel="Copy account number"
                    className="flex-row items-center gap-1.5 rounded-xl bg-brand-700 px-3 py-2 active:opacity-80"
                  >
                    <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={colors.white} />
                    <Text className="text-[13px] font-bold text-white">{copied ? 'Copied' : 'Copy'}</Text>
                  </Pressable>
                </View>
                {selected.account_title ? <Text className="mt-1 text-[13px] text-slate-600">Account title: {selected.account_title}</Text> : null}
              </View>
              <Text className="mt-3 text-[13px] leading-5 text-slate-500">
                Open your {selected.label} app, send the amount to this number, and keep the transaction ID (TID) from the receipt or SMS.
              </Text>
            </Card>

            {/* Amount + TID */}
            <Card className="gap-4 p-5">
              <Text className="text-base font-bold text-ink">2. Tell us what you sent</Text>
              <View className="flex-row flex-wrap gap-2">
                {QUICK.map((q) => (
                  <Chip key={q} label={formatPrice(q)} selected={value === q} onPress={() => setAmount(String(q))} />
                ))}
              </View>
              <Input
                label="Amount sent"
                prefix="Rs"
                keyboardType="number-pad"
                placeholder="1000"
                value={amount}
                onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
                hint="Between Rs 100 and Rs 50,000"
              />
              <Input
                label="Transaction ID (TID)"
                icon="receipt-outline"
                placeholder="e.g. 2847561930"
                autoCapitalize="characters"
                value={tid}
                onChangeText={setTid}
                hint={`Shown in your ${selected.label} receipt / SMS after the transfer`}
              />
            </Card>

            <View className="flex-row items-start gap-2 rounded-2xl bg-brand-50 p-3">
              <Ionicons name="time-outline" size={18} color={colors.brand} />
              <Text className="flex-1 text-[13px] leading-5 text-brand-800">
                Our team checks every transfer. Your balance is updated once it is verified — you can track it in Wallet → Requests.
              </Text>
            </View>
          </>
        ) : null}
      </ScrollView>

      <View className="rounded-t-3xl bg-white px-5 pt-4" style={[shadow.top, { paddingBottom: insets.bottom + 12 }]}>
        <Button
          title={!selected ? 'Choose a payment method' : ready ? `Submit ${formatPrice(value)}` : 'Enter amount & TID'}
          icon={ready ? 'checkmark-circle-outline' : undefined}
          onPress={submit}
          loading={busy}
          disabled={!ready}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
