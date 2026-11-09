import { supabase } from '@/lib/supabase';

export type PayMethod = 'easypaisa' | 'jazzcash' | 'sadapay' | 'nayapay';

export type PaymentAccount = {
  method: PayMethod;
  label: string;
  account_title: string;
  account_number: string;
  is_active: boolean;
  sort: number;
};

export type WalletTx = {
  id: number;
  amount: number;
  type: 'topup' | 'booking_payment' | 'booking_refund' | 'booking_earning' | 'withdrawal' | 'withdrawal_reversal' | 'adjustment';
  note: string;
  balance_after: number;
  created_at: string;
};

export type WalletRequest = {
  id: number;
  kind: 'topup' | 'withdraw';
  method: PayMethod;
  amount: number;
  reference: string;
  account_number: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string;
  created_at: string;
};

/** Brand-ish colours + initials for each wallet app (no third-party logos). */
export const METHOD_STYLE: Record<PayMethod, { bg: string; fg: string; initials: string }> = {
  easypaisa: { bg: '#E8F7EE', fg: '#13A04A', initials: 'EP' },
  jazzcash: { bg: '#FDECEA', fg: '#D9261C', initials: 'JC' },
  sadapay: { bg: '#E6F7F6', fg: '#0F9D94', initials: 'SP' },
  nayapay: { bg: '#EEEAFD', fg: '#5B3FD9', initials: 'NP' },
};

export const TX_META: Record<WalletTx['type'], { label: string; icon: 'add-circle' | 'cart' | 'arrow-undo' | 'cash' | 'arrow-up-circle' | 'refresh-circle' | 'create' }> = {
  topup: { label: 'Money added', icon: 'add-circle' },
  booking_payment: { label: 'Booking payment', icon: 'cart' },
  booking_refund: { label: 'Refund', icon: 'arrow-undo' },
  booking_earning: { label: 'Job earning', icon: 'cash' },
  withdrawal: { label: 'Withdrawal', icon: 'arrow-up-circle' },
  withdrawal_reversal: { label: 'Withdrawal returned', icon: 'refresh-circle' },
  adjustment: { label: 'Adjustment', icon: 'create' },
};

export async function fetchBalance(userId: string) {
  const { data } = await supabase.from('wallets').select('balance').eq('user_id', userId).maybeSingle();
  return Number(data?.balance ?? 0);
}

export async function fetchWallet(userId: string) {
  const [balance, tx, req] = await Promise.all([
    fetchBalance(userId),
    supabase
      .from('wallet_transactions')
      .select('id, amount, type, note, balance_after, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('wallet_requests')
      .select('id, kind, method, amount, reference, account_number, status, admin_note, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);
  return {
    balance,
    transactions: (tx.data as WalletTx[] | null) ?? [],
    requests: (req.data as WalletRequest[] | null) ?? [],
  };
}

export async function fetchPaymentAccounts() {
  const { data } = await supabase.from('payment_accounts').select('*').order('sort');
  return (data as PaymentAccount[] | null) ?? [];
}
