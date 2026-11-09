import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Chip, Input, Loader } from '@/components/ui';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { shadow } from '@/lib/theme';
import { fetchBalance, fetchPaymentAccounts, type PaymentAccount, type PayMethod } from '@/lib/wallet';
import { useAuth } from '@/providers/AuthProvider';

export default function Withdraw() {
  const { session, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [balance, setBalance] = useState<number | null>(null);
  const [methods, setMethods] = useState<PaymentAccount[]>([]);
  const [method, setMethod] = useState<PayMethod | null>(null);
  const [amount, setAmount] = useState('');
  const [number, setNumber] = useState(profile?.phone ?? '');
  const [title, setTitle] = useState(profile?.full_name ?? '');
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      fetchBalance(session.user.id).then(setBalance);
      fetchPaymentAccounts().then(setMethods);
    }, [session]),
  );

  if (balance === null) return <Loader />;

  const value = Number(amount);
  const ready = !!method && value >= 500 && value <= balance && number.replace(/\D/g, '').length >= 10 && title.trim().length >= 3;

  async function submit() {
    setBusy(true);
    const { error } = await supabase.rpc('request_withdrawal', {
      p_method: method,
      p_amount: value,
      p_account_number: number.trim(),
      p_account_title: title.trim(),
    });
    setBusy(false);
    if (error) {
      Alert.alert('Could not submit', error.message);
      return;
    }
    Alert.alert('Withdrawal requested', `${formatPrice(value)} will be sent to your ${methods.find((m) => m.method === method)?.label} account after review.`, [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-surface" behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerClassName="gap-4 px-5 pb-8 pt-1" keyboardShouldPersistTaps="handled">
        <Card className="p-5">
          <Text className="text-[13px] font-medium text-slate-500">Available to withdraw</Text>
          <Text className="mt-1 text-3xl font-extrabold tracking-tight text-ink">{formatPrice(balance)}</Text>
        </Card>

        <Card className="gap-4 p-5">
          <Text className="text-base font-bold text-ink">Send it to</Text>
          <View className="flex-row flex-wrap gap-2">
            {methods.map((m) => (
              <Chip key={m.method} label={m.label} selected={method === m.method} onPress={() => setMethod(m.method)} />
            ))}
          </View>
          <Input label="Mobile account number" icon="call-outline" keyboardType="phone-pad" placeholder="03xx xxxxxxx" value={number} onChangeText={setNumber} />
          <Input label="Account holder name" icon="person-outline" value={title} onChangeText={setTitle} />
        </Card>

        <Card className="gap-4 p-5">
          <Input
            label="Amount"
            prefix="Rs"
            keyboardType="number-pad"
            placeholder="500"
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
            hint={`Minimum Rs 500 · maximum ${formatPrice(balance)}`}
          />
          <Chip label="Withdraw all" selected={value === balance && balance > 0} onPress={() => setAmount(String(Math.floor(balance)))} />
        </Card>

        <Text className="px-1 text-[13px] leading-5 text-slate-500">
          The amount is reserved from your wallet right away and sent by the Eizi team after review. If a request is declined, the money comes back to your wallet.
        </Text>
      </ScrollView>

      <View className="rounded-t-3xl bg-white px-5 pt-4" style={[shadow.top, { paddingBottom: insets.bottom + 12 }]}>
        <Button title={ready ? `Withdraw ${formatPrice(value)}` : 'Fill in the details'} onPress={submit} loading={busy} disabled={!ready} />
      </View>
    </KeyboardAvoidingView>
  );
}
