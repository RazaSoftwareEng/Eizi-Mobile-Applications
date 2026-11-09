import { ArrowDownLeft, ArrowUpRight, CircleCheck, Landmark, RefreshCw, Save, Wallet as WalletIcon, X, type LucideIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useToast } from '../components/Toast'
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Modal,
  PageHeader,
  RoleBadge,
  SearchInput,
  Spinner,
  Table,
  Tabs,
  Td,
  TextArea,
  TextField,
  Th,
  Toggle,
} from '../components/ui'
import { formatDateTime, formatPrice, timeAgo } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { Account, Role } from '../lib/types'
import { must, useLoad } from '../lib/useLoad'

type Method = 'easypaisa' | 'jazzcash' | 'sadapay' | 'nayapay'
type Req = {
  id: number
  user_id: string
  kind: 'topup' | 'withdraw'
  method: Method
  amount: number
  reference: string
  account_title: string
  account_number: string
  status: 'pending' | 'approved' | 'rejected'
  admin_note: string
  created_at: string
  reviewed_at: string | null
  user: { full_name: string; role: Role | null; phone: string | null } | null
  email?: string | null
}
type WalletRow = { user_id: string; balance: number; updated_at: string; user: { full_name: string; role: Role | null } | null; email?: string | null }
type PayAccount = { method: Method; label: string; account_title: string; account_number: string; is_active: boolean; sort: number }
type Tab = 'topup' | 'withdraw' | 'balances' | 'accounts'

const METHOD: Record<Method, { label: string; cls: string }> = {
  easypaisa: { label: 'EasyPaisa', cls: 'bg-green-50 text-green-700 ring-green-600/20' },
  jazzcash: { label: 'JazzCash', cls: 'bg-red-50 text-red-700 ring-red-600/20' },
  sadapay: { label: 'SadaPay', cls: 'bg-teal-50 text-teal-700 ring-teal-600/20' },
  nayapay: { label: 'NayaPay', cls: 'bg-violet-50 text-violet-700 ring-violet-600/20' },
}

async function loadWallet() {
  const [requests, wallets, accounts, held, emails] = await Promise.all([
    supabase
      .from('wallet_requests')
      .select('*, user:profiles(full_name, role, phone)')
      .order('created_at', { ascending: false })
      .limit(500)
      .then((r) => must(r) as unknown as Req[]),
    supabase
      .from('wallets')
      .select('user_id, balance, updated_at, user:profiles(full_name, role)')
      .order('balance', { ascending: false })
      .then((r) => must(r) as unknown as WalletRow[]),
    supabase.from('payment_accounts').select('*').order('sort').then((r) => must(r) as PayAccount[]),
    supabase
      .from('bookings')
      .select('total_price')
      .eq('payment_status', 'held')
      .then((r) => (must(r) as { total_price: number }[]).reduce((s, b) => s + Number(b.total_price), 0)),
    supabase.rpc('admin_list_accounts').then((r) => new Map((must(r) as Account[]).map((a) => [a.id, a.email]))),
  ])
  return {
    requests: requests.map((r) => ({ ...r, email: emails.get(r.user_id) ?? null })),
    wallets: wallets.map((w) => ({ ...w, email: emails.get(w.user_id) ?? null })),
    accounts,
    held,
  }
}

export function Wallet() {
  const { data, loading, error, reload } = useLoad(loadWallet)
  const [tab, setTab] = useState<Tab>('topup')
  const [query, setQuery] = useState('')
  const [reviewing, setReviewing] = useState<{ req: Req; approve: boolean } | null>(null)

  const pendingTopups = data?.requests.filter((r) => r.kind === 'topup' && r.status === 'pending') ?? []
  const pendingWithdrawals = data?.requests.filter((r) => r.kind === 'withdraw' && r.status === 'pending') ?? []
  const sum = (rs: { amount?: number; balance?: number }[], k: 'amount' | 'balance') => rs.reduce((s, r) => s + Number(r[k] ?? 0), 0)

  const visibleRequests = useMemo(() => {
    if (!data || (tab !== 'topup' && tab !== 'withdraw')) return []
    const q = query.trim().toLowerCase()
    return data.requests
      .filter((r) => r.kind === tab)
      .filter((r) => !q || [r.user?.full_name, r.email, r.reference, r.account_number, String(r.id)].some((v) => v?.toLowerCase().includes(q)))
      .sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1))
  }, [data, tab, query])

  return (
    <>
      <PageHeader
        title="Wallet"
        subtitle="Verify top-ups, pay out withdrawals and manage Eizi's receiving accounts."
        actions={
          <Button variant="secondary" icon={RefreshCw} onClick={reload} loading={loading && !!data}>
            Refresh
          </Button>
        }
      />
      {error ? <ErrorBanner message={error} onRetry={reload} /> : null}

      {!data ? (
        loading ? <Spinner /> : null
      ) : (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={ArrowDownLeft} tone="amber" label="Top-ups to verify" value={String(pendingTopups.length)} foot={`${formatPrice(sum(pendingTopups, 'amount'))} claimed`} />
            <Stat icon={ArrowUpRight} tone="blue" label="Withdrawals to pay" value={String(pendingWithdrawals.length)} foot={`${formatPrice(sum(pendingWithdrawals, 'amount'))} reserved`} />
            <Stat icon={WalletIcon} tone="brand" label="All wallet balances" value={formatPrice(sum(data.wallets, 'balance'))} foot={`${data.wallets.filter((w) => Number(w.balance) > 0).length} users with money`} />
            <Stat icon={Landmark} tone="emerald" label="Held in bookings" value={formatPrice(data.held)} foot="Paid by customers, not yet released" />
          </div>

          <Card>
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between">
              <Tabs<Tab>
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'topup', label: 'Top-ups', count: pendingTopups.length },
                  { value: 'withdraw', label: 'Withdrawals', count: pendingWithdrawals.length },
                  { value: 'balances', label: 'Balances' },
                  { value: 'accounts', label: 'Payment accounts' },
                ]}
              />
              {tab === 'topup' || tab === 'withdraw' ? <SearchInput value={query} onChange={setQuery} placeholder="Search name, email, TID, number…" /> : null}
            </div>

            {tab === 'topup' || tab === 'withdraw' ? (
              visibleRequests.length === 0 ? (
                <EmptyState icon={tab === 'topup' ? ArrowDownLeft : ArrowUpRight} title={tab === 'topup' ? 'No top-up requests' : 'No withdrawal requests'} />
              ) : (
                <Table
                  head={
                    <tr>
                      <Th>User</Th>
                      <Th>Method</Th>
                      <Th className="text-right">Amount</Th>
                      <Th>{tab === 'topup' ? 'Transaction ID' : 'Pay to'}</Th>
                      <Th className="hidden lg:table-cell">Requested</Th>
                      <Th className="text-right">Status / action</Th>
                    </tr>
                  }
                >
                  {visibleRequests.map((r) => (
                    <tr key={r.id} className={`align-top transition hover:bg-slate-50/70 ${r.status === 'pending' ? '' : 'text-slate-500'}`}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <Avatar name={r.user?.full_name || r.email} />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-ink">{r.user?.full_name || 'No name'}</p>
                            <p className="truncate text-xs text-slate-500">{r.email ?? r.user?.phone ?? '—'}</p>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <MethodBadge method={r.method} />
                      </Td>
                      <Td className="text-right font-bold whitespace-nowrap text-ink tabular-nums">{formatPrice(r.amount)}</Td>
                      <Td>
                        {r.kind === 'topup' ? (
                          <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-ink">{r.reference}</span>
                        ) : (
                          <div>
                            <p className="font-mono text-xs text-ink">{r.account_number}</p>
                            <p className="text-xs text-slate-500">{r.account_title}</p>
                          </div>
                        )}
                      </Td>
                      <Td className="hidden whitespace-nowrap lg:table-cell">
                        <p>{formatDateTime(r.created_at)}</p>
                        <p className="text-xs text-slate-400">{timeAgo(r.created_at)}</p>
                      </Td>
                      <Td className="text-right">
                        {r.status === 'pending' ? (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="secondary" icon={X} onClick={() => setReviewing({ req: r, approve: false })}>
                              Reject
                            </Button>
                            <Button size="sm" icon={CircleCheck} onClick={() => setReviewing({ req: r, approve: true })}>
                              {r.kind === 'topup' ? 'Approve' : 'Mark paid'}
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end gap-1">
                            <StatusPill status={r.status} kind={r.kind} />
                            {r.admin_note ? <p className="max-w-56 text-right text-xs text-slate-500">{r.admin_note}</p> : null}
                          </div>
                        )}
                      </Td>
                    </tr>
                  ))}
                </Table>
              )
            ) : null}

            {tab === 'balances' ? (
              data.wallets.length === 0 ? (
                <EmptyState icon={WalletIcon} title="No wallets yet" text="Wallets appear after a user's first top-up or earning." />
              ) : (
                <Table
                  head={
                    <tr>
                      <Th>User</Th>
                      <Th>Role</Th>
                      <Th className="text-right">Balance</Th>
                      <Th className="hidden md:table-cell">Last change</Th>
                    </tr>
                  }
                >
                  {data.wallets.map((w) => (
                    <tr key={w.user_id} className="transition hover:bg-slate-50/70">
                      <Td>
                        <div className="flex items-center gap-3">
                          <Avatar name={w.user?.full_name || w.email} />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-ink">{w.user?.full_name || 'No name'}</p>
                            <p className="truncate text-xs text-slate-500">{w.email ?? '—'}</p>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <RoleBadge role={w.user?.role ?? null} />
                      </Td>
                      <Td className="text-right font-bold text-ink tabular-nums">{formatPrice(w.balance)}</Td>
                      <Td className="hidden text-slate-500 md:table-cell">{timeAgo(w.updated_at)}</Td>
                    </tr>
                  ))}
                </Table>
              )
            ) : null}

            {tab === 'accounts' ? <AccountsEditor accounts={data.accounts} onSaved={reload} /> : null}
          </Card>
        </div>
      )}

      {reviewing ? (
        <ReviewModal
          req={reviewing.req}
          approve={reviewing.approve}
          onClose={() => setReviewing(null)}
          onDone={() => {
            setReviewing(null)
            reload()
          }}
        />
      ) : null}
    </>
  )
}

function MethodBadge({ method }: { method: Method }) {
  const m = METHOD[method]
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset ${m.cls}`}>{m.label}</span>
}

function StatusPill({ status, kind }: { status: Req['status']; kind: Req['kind'] }) {
  if (status === 'approved')
    return <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">{kind === 'topup' ? 'Approved' : 'Paid'}</span>
  if (status === 'rejected') return <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">Rejected</span>
  return <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Pending</span>
}

const tones = {
  brand: 'bg-brand-50 text-brand-700',
  blue: 'bg-blue-50 text-blue-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
}

function Stat({ icon: Icon, tone, label, value, foot }: { icon: LucideIcon; tone: keyof typeof tones; label: string; value: string; foot: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className={`flex size-9 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon className="size-[18px]" />
        </span>
      </div>
      <p className="mt-2 text-[28px] leading-tight font-bold tracking-tight text-ink">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{foot}</p>
    </Card>
  )
}

function ReviewModal({ req, approve, onClose, onDone }: { req: Req; approve: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const [note, setNote] = useState('')
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const m = METHOD[req.method]
  const isTopup = req.kind === 'topup'

  const title = isTopup ? (approve ? 'Approve top-up' : 'Reject top-up') : approve ? 'Mark withdrawal as paid' : 'Reject withdrawal'
  const confirmText = isTopup
    ? `I have checked our ${m.label} account and received ${formatPrice(req.amount)} with TID ${req.reference}.`
    : `I have sent ${formatPrice(req.amount)} to ${req.account_title} (${req.account_number}) via ${m.label}.`

  async function submit() {
    if (!approve && note.trim().length < 3) return toast.error('Please write a short reason — the user will see it.')
    setBusy(true)
    const { error } = await supabase.rpc('admin_review_wallet_request', { p_id: req.id, p_approve: approve, p_note: note.trim() })
    setBusy(false)
    if (error) return toast.error(error.message)
    toast.success(
      isTopup
        ? approve
          ? `${formatPrice(req.amount)} added to ${req.user?.full_name || 'the user'}'s wallet`
          : 'Top-up rejected'
        : approve
          ? 'Withdrawal marked as paid'
          : `${formatPrice(req.amount)} returned to ${req.user?.full_name || 'the user'}'s wallet`,
    )
    onDone()
  }

  return (
    <Modal
      open
      title={title}
      subtitle={`${req.user?.full_name || req.email || 'User'} · ${m.label} · ${formatPrice(req.amount)}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={approve ? 'primary' : 'danger'} onClick={submit} loading={busy} disabled={approve && !checked}>
            {approve ? (isTopup ? 'Approve & add money' : 'Mark as paid') : 'Reject'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm">
          <Detail label="Amount" value={formatPrice(req.amount)} strong />
          <Detail label="Method" value={m.label} />
          {isTopup ? (
            <Detail label="Transaction ID" value={req.reference} mono />
          ) : (
            <>
              <Detail label="Account number" value={req.account_number} mono />
              <Detail label="Account title" value={req.account_title} />
            </>
          )}
          <Detail label="Requested" value={formatDateTime(req.created_at)} />
        </div>

        {approve ? (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 size-4 accent-brand-700" />
            <span className="text-sm text-amber-900">{confirmText}</span>
          </label>
        ) : (
          <p className="text-sm text-slate-600">
            {isTopup
              ? 'No money is added. The user sees your reason in the app.'
              : `The reserved ${formatPrice(req.amount)} goes back to the user's wallet.`}
          </p>
        )}
        <TextArea
          label={approve ? 'Note (optional)' : 'Reason (shown to the user)'}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={approve ? 'e.g. verified in EasyPaisa statement' : 'e.g. TID not found in our account'}
        />
      </div>
    </Modal>
  )
}

function Detail({ label, value, strong, mono }: { label: string; value: string; strong?: boolean; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`${strong ? 'text-base font-bold' : 'font-medium'} ${mono ? 'font-mono' : ''} break-all text-ink`}>{value}</p>
    </div>
  )
}

function AccountsEditor({ accounts, onSaved }: { accounts: PayAccount[]; onSaved: () => void }) {
  const toast = useToast()
  const [rows, setRows] = useState(accounts)
  const [busy, setBusy] = useState(false)
  const set = (method: Method, patch: Partial<PayAccount>) => setRows((rs) => rs.map((r) => (r.method === method ? { ...r, ...patch } : r)))

  async function save() {
    setBusy(true)
    for (const r of rows) {
      const { error } = await supabase
        .from('payment_accounts')
        .update({ account_title: r.account_title.trim(), account_number: r.account_number.trim(), is_active: r.is_active })
        .eq('method', r.method)
      if (error) {
        setBusy(false)
        return toast.error(error.message)
      }
    }
    setBusy(false)
    toast.success('Payment accounts saved')
    onSaved()
  }

  return (
    <div className="p-5">
      <p className="mb-4 text-sm text-slate-600">
        Customers send money to these accounts when they add money manually. A method only shows in the app when it is <strong>active</strong> and has an{' '}
        <strong>account number</strong>.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((r) => (
          <div key={r.method} className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <MethodBadge method={r.method} />
              <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                {r.is_active ? 'Active' : 'Hidden'}
                <Toggle checked={r.is_active} onChange={(v) => set(r.method, { is_active: v })} label={`${r.label} active`} />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Account number" value={r.account_number} onChange={(e) => set(r.method, { account_number: e.target.value })} placeholder="03xx xxxxxxx" />
              <TextField label="Account title" value={r.account_title} onChange={(e) => set(r.method, { account_title: e.target.value })} placeholder="Eizi Services" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex justify-end">
        <Button icon={Save} onClick={save} loading={busy}>
          Save accounts
        </Button>
      </div>
    </div>
  )
}
