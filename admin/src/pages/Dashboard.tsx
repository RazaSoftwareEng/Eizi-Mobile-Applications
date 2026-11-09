import {
  ArrowDownRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarCheck,
  Clock,
  Layers,
  Minus,
  RefreshCw,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { BarChart, ChartCard, HBarList, Legend, LineChart } from '../components/charts'
import { Avatar, Button, EmptyState, ErrorBanner, RoleBadge, Spinner, StatusBadge, Tabs } from '../components/ui'
import { CHART } from '../lib/chartTheme'
import { formatDateTime, formatPrice, isToday, startOfToday, timeAgo } from '../lib/format'
import { supabase } from '../lib/supabase'
import { BOOKING_STATUSES, type Account, type Booking, type Profile } from '../lib/types'
import { must, useLoad } from '../lib/useLoad'

type Range = '7' | '14' | '30'

const BOOKING_JOIN =
  '*, customer:profiles!bookings_customer_id_fkey(full_name, phone), provider:profiles!bookings_provider_id_fkey(full_name, phone), service:services(name)'

const countOf = (q: PromiseLike<{ count: number | null; error: { message: string } | null }>) =>
  Promise.resolve(q).then((r) => {
    if (r.error) throw r.error
    return r.count ?? 0
  })

async function loadDashboard(days: number) {
  const today = startOfToday()
  const start = new Date(today)
  start.setDate(start.getDate() - (days - 1))
  const prevStart = new Date(start)
  prevStart.setDate(prevStart.getDate() - days)

  const [totals, profiles, bookings, accounts] = await Promise.all([
    Promise.all([
      countOf(supabase.from('profiles').select('*', { count: 'exact', head: true })),
      countOf(supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer')),
      countOf(supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'provider')),
      countOf(supabase.from('services').select('*', { count: 'exact', head: true })),
      countOf(supabase.from('provider_services').select('*', { count: 'exact', head: true }).eq('is_active', true)),
      countOf(supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'pending')),
    ]),
    supabase
      .from('profiles')
      .select('id, full_name, phone, role, created_at')
      .gte('created_at', prevStart.toISOString())
      .order('created_at', { ascending: false })
      .then((r) => must(r) as Profile[]),
    supabase
      .from('bookings')
      .select(BOOKING_JOIN)
      .gte('created_at', prevStart.toISOString())
      .order('created_at', { ascending: false })
      .then((r) => must(r) as unknown as Booking[]),
    supabase.rpc('admin_list_accounts').then((r) => (must(r) as Account[]) ?? []),
  ])
  const [users, customers, providers, services, listings, pending] = totals
  const accountById = new Map(accounts.map((a) => [a.id, a]))

  const inRange = (iso: string, from: Date, to?: Date) => {
    const t = new Date(iso)
    return t >= from && (!to || t < to)
  }
  const cur = { profiles: profiles.filter((p) => inRange(p.created_at, start)), bookings: bookings.filter((b) => inRange(b.created_at, start)) }
  const prev = {
    profiles: profiles.filter((p) => inRange(p.created_at, prevStart, start)),
    bookings: bookings.filter((b) => inRange(b.created_at, prevStart, start)),
  }
  const sum = (bs: Booking[]) => bs.filter((b) => b.status !== 'cancelled' && b.status !== 'rejected').reduce((s, b) => s + Number(b.total_price), 0)

  // One bucket per day, oldest → newest
  const daily = Array.from({ length: days }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const next = new Date(d)
    next.setDate(next.getDate() + 1)
    const ps = cur.profiles.filter((p) => inRange(p.created_at, d, next))
    const bs = cur.bookings.filter((b) => inRange(b.created_at, d, next))
    return {
      label: d.toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short' }),
      short: d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' }),
      customers: ps.filter((p) => p.role === 'customer').length,
      providers: ps.filter((p) => p.role === 'provider').length,
      users: ps.length,
      bookings: bs.length,
      value: sum(bs),
    }
  })

  const byService = new Map<string, { count: number; value: number }>()
  for (const b of cur.bookings) {
    const k = b.service?.name ?? 'Unknown'
    const e = byService.get(k) ?? { count: 0, value: 0 }
    byService.set(k, { count: e.count + 1, value: e.value + Number(b.total_price) })
  }

  return {
    totals: { users, customers, providers, services, listings, pending },
    kpi: {
      users: [cur.profiles.length, prev.profiles.length],
      bookings: [cur.bookings.length, prev.bookings.length],
      value: [sum(cur.bookings), sum(prev.bookings)],
    },
    daily,
    statusMix: BOOKING_STATUSES.map((s) => ({ status: s, count: cur.bookings.filter((b) => b.status === s).length })),
    topServices: [...byService.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 6),
    newToday: profiles.filter((p) => isToday(p.created_at)).map((p) => ({ ...p, email: accountById.get(p.id)?.email ?? null })),
    latest: bookings.slice(0, 6),
  }
}

export function Dashboard() {
  const [range, setRange] = useState<Range>('7')
  const days = Number(range)
  const { data, loading, error, reload } = useLoad(() => loadDashboard(days), [days])
  const rangeLabel = `last ${days} days`

  return (
    <>
      {/* Header + filters: one row above everything they scope */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[28px]">Good {greeting()}</h1>
          <p className="mt-1 text-sm text-slate-500">Here’s what’s happening on Eizi — {rangeLabel}.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs<Range>
            value={range}
            onChange={setRange}
            options={[
              { value: '7', label: '7 days' },
              { value: '14', label: '14 days' },
              { value: '30', label: '30 days' },
            ]}
          />
          <Button variant="secondary" icon={RefreshCw} onClick={reload} loading={loading && !!data} aria-label="Refresh">
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {error ? <ErrorBanner message={error} onRetry={reload} /> : null}

      {!data ? (
        loading ? <Spinner /> : null
      ) : (
        <div className={`space-y-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {/* KPI tiles */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi icon={UserPlus} tone="blue" label="New users" value={String(data.kpi.users[0])} delta={data.kpi.users} period={days} to="/admin/users" />
            <Kpi icon={CalendarCheck} tone="brand" label="Bookings made" value={String(data.kpi.bookings[0])} delta={data.kpi.bookings} period={days} to="/admin/bookings" />
            <Kpi icon={Wallet} tone="emerald" label="Booking value" value={formatPrice(data.kpi.value[0])} delta={data.kpi.value} period={days} note="Excludes cancelled & declined" />
            <Kpi
              icon={Clock}
              tone="amber"
              label="Pending right now"
              value={String(data.totals.pending)}
              to="/admin/bookings"
              note={data.totals.pending ? 'Waiting for a provider to accept' : 'All caught up'}
            />
          </div>

          {/* Totals strip */}
          <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card lg:grid-cols-5">
            <Total icon={Users} label="Total users" value={data.totals.users} to="/admin/users" />
            <Total dot={CHART.series1} label="Customers" value={data.totals.customers} to="/admin/users" />
            <Total dot={CHART.series2} label="Providers" value={data.totals.providers} to="/admin/users" />
            <Total icon={Layers} label="Services" value={data.totals.services} to="/admin/services" />
            <Total icon={BriefcaseBusiness} label="Live listings" value={data.totals.listings} to="/admin/listings" className="col-span-2 lg:col-span-1" />
          </div>

          {/* Charts */}
          <div className="grid gap-6 xl:grid-cols-3">
            <ChartCard
              className="xl:col-span-2"
              title="Bookings per day"
              subtitle={`Bookings created, ${rangeLabel}`}
              table={{ head: ['Day', 'Bookings', 'Value'], rows: data.daily.map((d) => [d.label, d.bookings, formatPrice(d.value)]) }}
            >
              <BarChart name="bookings" data={data.daily.map((d) => ({ label: d.label, short: d.short, value: d.bookings }))} />
            </ChartCard>

            <ChartCard title="Booking status" subtitle={`Bookings created, ${rangeLabel}`}>
              <HBarList
                items={data.statusMix.map((s) => ({ key: s.status, label: <StatusBadge status={s.status} />, value: s.count }))}
                empty={<EmptyState icon={CalendarCheck} title="No bookings in this period" />}
              />
            </ChartCard>

            <ChartCard
              className="xl:col-span-2"
              title="New sign-ups"
              subtitle={`Customers vs providers, ${rangeLabel}`}
              legend={
                <Legend
                  items={[
                    { name: 'Customers', color: CHART.series1 },
                    { name: 'Providers', color: CHART.series2 },
                  ]}
                />
              }
              table={{ head: ['Day', 'Customers', 'Providers', 'All'], rows: data.daily.map((d) => [d.label, d.customers, d.providers, d.users]) }}
            >
              <LineChart
                labels={data.daily.map((d) => d.label)}
                shortLabels={data.daily.map((d) => d.short)}
                series={[
                  { name: 'Customers', color: CHART.series1, values: data.daily.map((d) => d.customers) },
                  { name: 'Providers', color: CHART.series2, values: data.daily.map((d) => d.providers) },
                ]}
              />
            </ChartCard>

            <ChartCard title="Top services" subtitle={`By number of bookings, ${rangeLabel}`}>
              <HBarList
                items={data.topServices.map(([name, v]) => ({ key: name, label: name, value: v.count, note: formatPrice(v.value) }))}
                empty={<EmptyState icon={Layers} title="No bookings in this period" />}
              />
            </ChartCard>
          </div>

          {/* Activity */}
          <div className="grid gap-6 xl:grid-cols-2">
            <Panel title="New users today" count={data.newToday.length} link="/admin/users">
              {data.newToday.length === 0 ? (
                <EmptyState icon={UserPlus} title="No sign-ups yet today" text="New customers and providers will appear here as they join." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.newToday.map((u) => (
                    <li key={u.id} className="flex items-center gap-3 px-5 py-3">
                      <Avatar name={u.full_name || u.email} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{u.full_name || 'No name'}</p>
                        <p className="truncate text-xs text-slate-500">
                          {u.email ?? '—'}
                          {u.phone ? ` · ${u.phone}` : ''}
                        </p>
                      </div>
                      <RoleBadge role={u.role} />
                      <span className="hidden w-20 text-right text-xs text-slate-400 sm:block">{timeAgo(u.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Latest bookings" link="/admin/bookings">
              {data.latest.length === 0 ? (
                <EmptyState icon={CalendarCheck} title="No recent bookings" />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.latest.map((b) => (
                    <li key={b.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">
                          {b.service?.name} <span className="font-mono text-xs font-normal text-slate-400">#{b.id}</span>
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {b.customer?.full_name || '—'} → {b.provider?.full_name || '—'} · {formatDateTime(b.scheduled_at)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-sm font-semibold text-ink tabular-nums">{formatPrice(b.total_price)}</span>
                        <StatusBadge status={b.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}
    </>
  )
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
}

const tones = {
  brand: 'bg-brand-50 text-brand-700',
  blue: 'bg-blue-50 text-blue-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
}

function Kpi({ icon: Icon, tone, label, value, delta, period, note, to }: {
  icon: LucideIcon
  tone: keyof typeof tones
  label: string
  value: string
  delta?: number[]
  period?: number
  note?: string
  to?: string
}) {
  let change: ReactNode = null
  if (delta) {
    const [now, before] = delta
    const diff = now - before
    const pct = before ? Math.round((diff / before) * 100) : null
    const Arrow = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus
    const cls = diff > 0 ? 'bg-emerald-50 text-emerald-700' : diff < 0 ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'
    change = (
      <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold ${cls}`}>
          <Arrow className="size-3.5" />
          {pct === null ? (diff ? 'New' : '0%') : `${Math.abs(pct)}%`}
        </span>
        vs previous {period} days
      </p>
    )
  }
  const body = (
    <div className={`h-full rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card transition ${to ? 'hover:-translate-y-0.5 hover:shadow-pop' : ''}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className={`flex size-9 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon className="size-[18px]" />
        </span>
      </div>
      <p className="mt-2 text-[32px] leading-tight font-bold tracking-tight text-ink">{value}</p>
      {change}
      {note ? <p className="mt-1 text-xs text-slate-500">{note}</p> : null}
    </div>
  )
  return to ? (
    <Link to={to} className="rounded-2xl focus-visible:ring-4 focus-visible:ring-brand-500/20 focus-visible:outline-none">
      {body}
    </Link>
  ) : (
    body
  )
}

function Total({ icon: Icon, dot, label, value, to, className = '' }: {
  icon?: LucideIcon
  dot?: string
  label: string
  value: number
  to: string
  className?: string
}) {
  return (
    <Link to={to} className={`flex items-center gap-3 border-slate-100 px-5 py-4 transition hover:bg-slate-50 lg:border-r lg:last:border-r-0 ${className}`}>
      {Icon ? <Icon className="size-4 text-slate-400" /> : <span className="size-2.5 rounded-full" style={{ background: dot }} />}
      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-lg font-bold text-ink tabular-nums">{value}</p>
      </div>
    </Link>
  )
}

function Panel({ title, count, link, children }: { title: string; count?: number; link: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="flex items-center gap-2 font-bold text-ink">
          {title}
          {count !== undefined ? <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">{count}</span> : null}
        </h2>
        <Link to={link} className="text-sm font-semibold text-brand-700 hover:underline">
          View all
        </Link>
      </div>
      {children}
    </section>
  )
}
