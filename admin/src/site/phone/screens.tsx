import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Bell,
  BrushCleaning,
  CalendarCheck,
  Check,
  ChefHat,
  ChevronRight,
  CircleCheck,
  Clock,
  Copy,
  Hand,
  HardHat,
  Hourglass,
  House,
  MapPin,
  Menu,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Wallet,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'

/* Miniature, pixel-faithful replicas of the Eizi mobile screens (same colours, cards and icons as the app). */

export type ScreenId =
  | 'splash'
  | 'signup'
  | 'home'
  | 'providers'
  | 'book'
  | 'pay'
  | 'bookings'
  | 'p-dashboard'
  | 'p-services'
  | 'p-complete'
  | 'p-wallet'
  | 'w-add'
  | 'w-tid'
  | 'w-verifying'
  | 'w-balance'

export function Screen({ id }: { id: ScreenId }) {
  const S = SCREENS[id]
  return (
    <div key={id} className="screen-in absolute inset-0">
      <S />
    </div>
  )
}

/* ------------------------------------------------------------------ building blocks */

function StatusBar({ light }: { light?: boolean }) {
  return (
    <div className={`flex h-7 items-center justify-between px-5 pt-1 text-[9px] font-semibold ${light ? 'text-white' : 'text-ink'}`}>
      <span>9:41</span>
      <span className="flex items-center gap-1">
        <span className="flex items-end gap-[1.5px]">
          {[3, 5, 7, 9].map((h) => (
            <span key={h} className={`w-[2px] rounded-sm ${light ? 'bg-white' : 'bg-ink'}`} style={{ height: h }} />
          ))}
        </span>
        <span className={`ml-1 h-[8px] w-[15px] rounded-[2px] border ${light ? 'border-white' : 'border-ink'} p-[1px]`}>
          <span className={`block h-full w-3/4 rounded-[1px] ${light ? 'bg-white' : 'bg-ink'}`} />
        </span>
      </span>
    </div>
  )
}

function AppBar({ title, back, bg = 'bg-[#e6f6f2]' }: { title?: string; back?: boolean; bg?: string }) {
  return (
    <div className={`flex items-center justify-between px-3 pb-2 ${bg}`}>
      <span className="flex size-7 items-center justify-center rounded-full bg-white shadow-sm">
        {back ? <ChevronRight className="size-3.5 rotate-180 text-ink" /> : <Menu className="size-3.5 text-ink" />}
      </span>
      {title ? (
        <span className="text-[11px] font-bold text-ink">{title}</span>
      ) : (
        <span className="flex items-center gap-1">
          <Logo size={18} />
          <span className="text-[12px] font-extrabold text-ink">Eizi</span>
        </span>
      )}
      <span className="relative flex size-7 items-center justify-center rounded-full bg-white shadow-sm">
        <Bell className="size-3.5 text-ink" />
        <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full border border-white bg-red-500" />
      </span>
    </div>
  )
}

function Logo({ size = 40 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center bg-white font-black text-brand-700 shadow"
      style={{ width: size, height: size, borderRadius: size * 0.27, fontSize: size * 0.58 }}
    >
      E
    </span>
  )
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl bg-white shadow-[0_1px_2px_rgba(15,23,42,.05),0_4px_12px_rgba(15,23,42,.07)] ${className}`}>{children}</div>
}

function Btn({ children, light, className = '' }: { children: ReactNode; light?: boolean; className?: string }) {
  return (
    <div
      className={`flex h-8 items-center justify-center gap-1 rounded-lg text-[10px] font-bold ${
        light ? 'bg-white text-brand-800' : 'bg-brand-700 text-white shadow-[0_4px_10px_rgba(11,99,88,.35)]'
      } ${className}`}
    >
      {children}
    </div>
  )
}

function Badge({ tone, children }: { tone: 'amber' | 'sky' | 'emerald' | 'violet' | 'red'; children: ReactNode }) {
  const t = {
    amber: 'bg-amber-50 text-amber-700',
    sky: 'bg-sky-50 text-sky-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    violet: 'bg-violet-50 text-violet-700',
    red: 'bg-red-50 text-red-700',
  }[tone]
  return <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-bold ${t}`}>{children}</span>
}

function Tile({ icon: Icon, bg, fg, size = 30 }: { icon: LucideIcon; bg: string; fg: string; size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-lg" style={{ width: size, height: size, background: bg }}>
      <Icon style={{ width: size * 0.5, height: size * 0.5, color: fg }} />
    </span>
  )
}

const svc = {
  cook: { icon: ChefHat, bg: '#EEF2FF', fg: '#4338CA', name: 'Cook' },
  clean: { icon: BrushCleaning, bg: '#F3EEFD', fg: '#6D28D9', name: 'House Cleaner' },
  elec: { icon: Zap, bg: '#FDECF2', fg: '#BE185D', name: 'Electrician' },
  plumb: { icon: Wrench, bg: '#E7F3FE', fg: '#1D4ED8', name: 'Plumber' },
}

/* ------------------------------------------------------------------ customer */

function Splash() {
  return (
    <div className="flex h-full flex-col bg-brand-900">
      <StatusBar light />
      <div className="relative flex flex-1 flex-col items-center justify-center">
        <div className="absolute -top-10 -right-16 size-48 rounded-full bg-white/5" />
        <div className="absolute -bottom-12 -left-14 size-40 rounded-full bg-brand-500/20" />
        <div className="relative">
          <span className="absolute inset-0 animate-ping rounded-[22px] bg-white/20" />
          <Logo size={72} />
        </div>
        <p className="mt-5 text-2xl font-extrabold text-white">Eizi</p>
        <p className="mt-1 text-[10px] font-medium text-brand-200">Ghar ki har service, ek tap door</p>
      </div>
      <div className="mx-auto mb-10 h-1 w-20 overflow-hidden rounded-full bg-white/15">
        <div className="h-full w-3/4 rounded-full bg-white" />
      </div>
    </div>
  )
}

function Signup() {
  return (
    <div className="flex h-full flex-col bg-brand-800">
      <StatusBar light />
      <div className="px-4 pt-3 pb-5">
        <div className="flex items-center gap-1.5">
          <Logo size={22} />
          <span className="text-[13px] font-extrabold text-white">Eizi</span>
        </div>
        <p className="mt-4 text-[17px] leading-tight font-bold text-white">Create your account</p>
        <p className="mt-1 text-[9px] text-brand-100">Book trusted help — or start earning.</p>
      </div>
      <div className="flex-1 rounded-t-[22px] bg-surface px-3.5 pt-4">
        <p className="mb-1.5 text-[8px] font-semibold text-slate-600">I want to join as</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: House, t: 'Customer', s: 'I need a service', on: true },
            { icon: HardHat, t: 'Provider', s: 'I offer a service', on: false },
          ].map((r) => (
            <Card key={r.t} className={`border-2 p-2 ${r.on ? 'border-brand-600' : 'border-transparent'}`}>
              <div className="flex items-start justify-between">
                <Tile icon={r.icon} bg={r.on ? '#0b6358' : '#eef9f7'} fg={r.on ? '#fff' : '#0b6358'} size={24} />
                {r.on ? <CircleCheck className="size-3 text-brand-600" /> : <span className="size-3 rounded-full border border-slate-300" />}
              </div>
              <p className="mt-1.5 text-[10px] font-bold text-ink">{r.t}</p>
              <p className="text-[7.5px] text-slate-500">{r.s}</p>
            </Card>
          ))}
        </div>
        {['Full name', 'Phone number', 'Email', 'Password'].map((l, i) => (
          <div key={l} className="mt-2">
            <p className="mb-0.5 text-[7.5px] font-semibold text-slate-600">{l}</p>
            <div className={`h-6 rounded-md border bg-white px-2 text-[8px] leading-6 ${i === 0 ? 'border-brand-500 text-ink' : 'border-line text-slate-400'}`}>
              {['Kashaf Ahmed', '0300 1234567', 'kashaf@mail.com', '••••••••'][i]}
            </div>
          </div>
        ))}
        <Btn className="mt-3">Create account</Btn>
      </div>
    </div>
  )
}

function Home() {
  return (
    <div className="h-full bg-surface">
      <div className="bg-gradient-to-b from-[#e6f6f2] to-surface">
        <StatusBar />
        <AppBar />
        <div className="relative px-3.5 pb-3">
          <div className="absolute top-0 right-1">
            <div className="relative">
              <span className="absolute -top-2 -right-8 size-20 rounded-full bg-gradient-to-br from-brand-400 to-brand-700" />
              <span className="relative block rotate-[-10deg]">
                <Logo size={38} />
              </span>
            </div>
          </div>
          <p className="text-[9px] text-slate-500">Good afternoon,</p>
          <p className="flex items-center gap-1 text-[14px] font-extrabold text-ink">
            Kashaf <Hand className="size-3 text-amber-500" />
          </p>
          <p className="mt-2 text-[14px] leading-[18px] font-extrabold text-ink">
            What can we help
            <br />
            you with <span className="text-brand-600 underline decoration-brand-500 decoration-2 underline-offset-2">today?</span>
          </p>
          <div className="mt-2.5 flex h-8 items-center gap-1.5 rounded-full bg-white pr-1 pl-2.5 shadow-md">
            <Search className="size-3 text-brand-600" />
            <span className="flex-1 text-[8px] text-slate-400">Search cook, electrician…</span>
            <span className="flex size-6 items-center justify-center rounded-full bg-brand-700">
              <ArrowRight className="size-3 text-white" />
            </span>
          </div>
        </div>
      </div>
      <div className="px-3.5">
        <p className="text-[10px] font-bold text-ink">Care & daily help</p>
        <p className="mb-1.5 text-[7.5px] text-slate-500">2 of 3 available now</p>
        <div className="grid grid-cols-2 gap-2">
          {[svc.cook, svc.clean, svc.elec, svc.plumb].map((s, i) => (
            <Card key={s.name} className={`p-2 ${i === 0 ? 'ring-2 ring-brand-500' : ''}`}>
              <div className="flex items-start justify-between">
                <span className="flex h-9 w-12 items-center justify-center rounded-[40%]" style={{ background: s.bg }}>
                  <s.icon className="size-5" style={{ color: s.fg }} />
                </span>
                <span className="flex size-4 items-center justify-center rounded-full bg-brand-50">
                  <ChevronRight className="size-2.5 text-brand-700" />
                </span>
              </div>
              <p className="mt-1 text-[9px] font-bold text-ink">{s.name}</p>
              {i < 3 ? (
                <span className="mt-1 inline-block rounded-full bg-brand-50 px-1.5 py-0.5 text-[7px] font-bold text-brand-800">from Rs {['1,500', '1,200', '800'][i]}/hr</span>
              ) : (
                <span className="mt-1 inline-block rounded-full bg-violet-50 px-1.5 py-0.5 text-[7px] font-bold text-violet-700">Coming soon</span>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

function Providers() {
  return (
    <div className="h-full bg-surface">
      <StatusBar />
      <AppBar title="Cook" back bg="bg-surface" />
      <div className="space-y-2 px-3.5">
        <div className="flex items-center gap-2 rounded-xl p-2.5" style={{ background: svc.cook.bg }}>
          <div className="flex-1">
            <p className="text-[13px] font-bold text-ink">Cook</p>
            <p className="text-[8px] text-slate-600">Home-cooked meals in your kitchen</p>
          </div>
          <Tile icon={ChefHat} bg="#fff" fg={svc.cook.fg} size={34} />
        </div>
        {[
          { n: 'Sana Bibi', r: '1,500', y: '2025' },
          { n: 'Ahmed Khan', r: '1,800', y: '2026' },
        ].map((p, i) => (
          <Card key={p.n} className={`p-2.5 ${i === 0 ? 'ring-2 ring-brand-500' : ''}`}>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-brand-50 text-[9px] font-bold text-brand-700">
                {p.n.split(' ').map((w) => w[0]).join('')}
              </span>
              <div className="flex-1">
                <p className="text-[10px] font-bold text-ink">{p.n}</p>
                <p className="text-[7.5px] text-slate-500">On Eizi since {p.y}</p>
              </div>
              <div className="rounded-lg bg-brand-50 px-1.5 py-1 text-right">
                <p className="text-[10px] font-bold text-brand-700">Rs {p.r}</p>
                <p className="text-[6.5px] text-brand-600">per hour</p>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="flex items-center gap-1 text-[7.5px] text-slate-500">
                <Clock className="size-2.5" />2 hrs ≈ Rs {i ? '3,600' : '3,000'}
              </span>
              <Btn className="h-6 px-3 text-[8.5px]">Book now</Btn>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function Book() {
  return (
    <div className="h-full bg-surface">
      <StatusBar />
      <AppBar title="Book a service" back bg="bg-surface" />
      <div className="space-y-2 px-3.5">
        <Card className="p-2.5">
          <StepTitle n={1} t="How many hours?" />
          <div className="mt-1.5 grid grid-cols-4 gap-1">
            {[1, 2, 3, 4].map((h) => (
              <div key={h} className={`rounded-md py-1 text-center ${h === 2 ? 'bg-brand-700 text-white shadow' : 'border border-line bg-white text-ink'}`}>
                <p className={`text-[6.5px] ${h === 2 ? 'text-brand-100' : 'text-slate-500'}`}>Rs {(1500 * h).toLocaleString()}</p>
                <p className="text-[9px] font-bold">{h} hr</p>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-2.5">
          <StepTitle n={2} t="Pick a day" />
          <div className="mt-1.5 flex gap-1">
            {['Today', 'Tue', 'Wed', 'Thu', 'Fri'].map((d, i) => (
              <div key={d} className={`flex-1 rounded-md py-1 text-center ${i === 1 ? 'bg-brand-700 text-white' : 'border border-line bg-white'}`}>
                <p className={`text-[6.5px] font-semibold uppercase ${i === 1 ? 'text-brand-100' : 'text-slate-500'}`}>{d}</p>
                <p className={`text-[10px] font-bold ${i === 1 ? '' : 'text-ink'}`}>{10 + i}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-2.5">
          <StepTitle n={3} t="Start time" />
          <div className="mt-1.5 grid grid-cols-3 gap-1">
            {['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM'].map((t) => (
              <div key={t} className={`rounded-md py-1 text-center text-[8px] font-semibold ${t === '10:00 AM' ? 'bg-brand-700 text-white' : 'border border-line bg-white text-ink'}`}>
                {t}
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-2.5">
          <StepTitle n={4} t="Where should they come?" />
          <div className="mt-1.5 flex h-6 items-center gap-1 rounded-md border border-line px-2 text-[8px] text-ink">
            <MapPin className="size-2.5 text-brand-600" /> House 12, DHA Phase 5, Lahore
          </div>
        </Card>
      </div>
    </div>
  )
}

function StepTitle({ n, t }: { n: number; t: string }) {
  return (
    <p className="flex items-center gap-1.5 text-[9.5px] font-bold text-ink">
      <span className="flex size-3.5 items-center justify-center rounded-full bg-brand-700 text-[7px] text-white">{n}</span>
      {t}
    </p>
  )
}

function Pay() {
  return (
    <div className="flex h-full flex-col bg-surface">
      <StatusBar />
      <AppBar title="Book a service" back bg="bg-surface" />
      <div className="flex-1 space-y-2 px-3.5">
        <Card className="p-2.5">
          <StepTitle n={5} t="How would you like to pay?" />
          <div className="mt-2 space-y-1.5">
            <PayOpt icon={Banknote} t="Pay after the job" s="Cash to the provider" />
            <PayOpt icon={Wallet} t="Pay from wallet" s="Balance Rs 5,000 · held safely" on />
          </div>
        </Card>
        <Card className="p-2.5">
          <p className="text-[10px] font-bold text-ink">Price details</p>
          <div className="mt-1 flex justify-between text-[8.5px] text-slate-500">
            <span>Rs 1,500 × 2 hours</span>
            <span className="font-semibold text-ink">Rs 3,000</span>
          </div>
          <div className="my-1.5 h-px bg-slate-100" />
          <div className="flex justify-between text-[10px] font-bold">
            <span className="text-ink">Total</span>
            <span className="text-brand-700">Rs 3,000</span>
          </div>
          <div className="mt-2 flex gap-1.5 rounded-md bg-brand-50 p-1.5 text-[7.5px] leading-snug text-brand-800">
            <ShieldCheck className="size-3 shrink-0 text-brand-600" />
            Released to the pro only after the job. Cancel for an instant refund.
          </div>
        </Card>
      </div>
      <div className="flex items-center gap-2 rounded-t-2xl bg-white px-3.5 pt-2.5 pb-5 shadow-[0_-6px_20px_rgba(15,23,42,.08)]">
        <div>
          <p className="text-[7.5px] text-slate-500">Total · 2 hrs</p>
          <p className="text-[13px] font-extrabold text-ink">Rs 3,000</p>
        </div>
        <Btn className="flex-1">Pay & book</Btn>
      </div>
    </div>
  )
}

function PayOpt({ icon: Icon, t, s, on }: { icon: LucideIcon; t: string; s: string; on?: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg border-2 p-1.5 ${on ? 'border-brand-600 bg-brand-50' : 'border-line bg-white'}`}>
      <Tile icon={Icon} bg={on ? '#0b6358' : '#f1f5f9'} fg={on ? '#fff' : '#64748b'} size={22} />
      <div className="flex-1">
        <p className="text-[9px] font-bold text-ink">{t}</p>
        <p className="text-[7px] text-slate-500">{s}</p>
      </div>
      <span className={`size-3 rounded-full border-2 ${on ? 'border-brand-600 bg-brand-600 shadow-[inset_0_0_0_2px_white]' : 'border-slate-300'}`} />
    </div>
  )
}

function Bookings() {
  return (
    <div className="h-full bg-surface">
      <StatusBar />
      <AppBar bg="bg-surface" />
      <div className="px-3.5">
        <p className="text-[15px] font-bold text-ink">My bookings</p>
        <div className="mt-1.5 mb-2 flex rounded-lg bg-slate-200/70 p-0.5 text-[8.5px] font-semibold">
          <span className="flex-1 rounded-md bg-white py-1 text-center text-ink shadow-sm">Active · 1</span>
          <span className="flex-1 py-1 text-center text-slate-500">Past</span>
        </div>
        <Card className="p-2.5">
          <div className="flex items-center gap-2">
            <Tile icon={ChefHat} bg={svc.cook.bg} fg={svc.cook.fg} />
            <div className="flex-1">
              <p className="text-[10px] font-bold text-ink">Cook</p>
              <p className="text-[7.5px] text-slate-500">Booking #128</p>
            </div>
            <Badge tone="sky">● Confirmed</Badge>
          </div>
          <div className="mt-2 space-y-1 rounded-lg bg-surface p-2 text-[8px] text-slate-600">
            <p className="flex items-center gap-1 font-semibold text-ink">
              <CalendarCheck className="size-2.5 text-brand-600" /> Tue, 11 Nov · 10:00 AM
            </p>
            <p className="flex items-center gap-1">
              <Clock className="size-2.5 text-brand-600" /> 2 hours
            </p>
            <p className="flex items-center gap-1">
              <MapPin className="size-2.5 text-brand-600" /> House 12, DHA Phase 5
            </p>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 rounded-md bg-brand-50 px-2 py-1 text-[7.5px] font-medium text-slate-700">
            <Wallet className="size-2.5 text-brand-700" /> Paid Rs 3,000 from wallet · held until done
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-brand-50 text-[8px] font-bold text-brand-700">SB</span>
            <div className="flex-1">
              <p className="text-[7px] text-slate-500">Your provider</p>
              <p className="text-[9px] font-semibold text-ink">Sana Bibi</p>
            </div>
            <p className="text-[11px] font-bold text-ink">Rs 3,000</p>
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ provider */

function ProviderDashboard() {
  return (
    <div className="h-full bg-surface">
      <div className="bg-gradient-to-b from-[#e6f6f2] to-surface">
        <StatusBar />
        <AppBar />
        <div className="px-3.5 pb-2">
          <p className="text-[9px] text-slate-500">Good morning,</p>
          <p className="text-[14px] font-extrabold text-ink">Sana</p>
          <p className="mt-1 text-[13px] leading-[17px] font-extrabold text-ink">
            Here's what's waiting <span className="text-brand-600">for you</span>
          </p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Card className="p-2">
              <Tile icon={Bell} bg="#fffbeb" fg="#b45309" size={20} />
              <p className="mt-1 text-[15px] font-extrabold text-ink">1</p>
              <p className="text-[7.5px] text-slate-500">New requests</p>
            </Card>
            <Card className="p-2">
              <Tile icon={CalendarCheck} bg="#f0f9ff" fg="#0369a1" size={20} />
              <p className="mt-1 text-[15px] font-extrabold text-ink">3</p>
              <p className="text-[7.5px] text-slate-500">Upcoming</p>
            </Card>
          </div>
        </div>
      </div>
      <div className="px-3.5">
        <Card className="p-2.5 ring-2 ring-brand-500">
          <div className="flex items-center gap-2">
            <Tile icon={ChefHat} bg={svc.cook.bg} fg={svc.cook.fg} />
            <div className="flex-1">
              <p className="text-[10px] font-bold text-ink">Cook · 2 hrs</p>
              <p className="text-[7.5px] text-slate-500">Tue, 11 Nov · 10:00 AM</p>
            </div>
            <Badge tone="amber">● Pending</Badge>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 rounded-md bg-brand-50 px-2 py-1 text-[7px] font-medium text-slate-700">
            <Wallet className="size-2.5 text-brand-700" /> Prepaid via wallet · Rs 3,000 on completion
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <div className="flex h-7 items-center justify-center rounded-lg border border-line bg-white text-[9px] font-bold text-ink">Decline</div>
            <Btn className="h-7">
              <Check className="size-3" /> Accept
            </Btn>
          </div>
        </Card>
      </div>
    </div>
  )
}

function ProviderServices() {
  return (
    <div className="h-full bg-surface">
      <StatusBar />
      <AppBar title="Your service" back bg="bg-surface" />
      <div className="space-y-2 px-3.5">
        <Card className="p-2.5">
          <p className="text-[10px] font-bold text-ink">What service do you offer?</p>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            {[svc.cook, svc.clean, svc.elec].map((s, i) => (
              <div key={s.name} className={`flex flex-col items-center rounded-lg border-2 py-1.5 ${i === 0 ? 'border-brand-600 bg-brand-50' : 'border-transparent bg-surface'}`}>
                <Tile icon={s.icon} bg={i === 0 ? '#fff' : s.bg} fg={s.fg} size={24} />
                <p className="mt-1 text-[7px] font-semibold text-ink">{s.name}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card className="space-y-2 p-2.5">
          <p className="text-[8px] font-semibold text-slate-600">Your price per hour</p>
          <div className="flex h-8 items-center rounded-lg border-2 border-brand-500 bg-white px-2 shadow-[0_0_0_3px_rgba(20,145,127,.12)]">
            <span className="text-[10px] font-semibold text-slate-500">Rs</span>
            <span className="ml-1.5 flex-1 text-[12px] font-bold text-ink">1,500</span>
            <span className="text-[8px] text-slate-500">/ hour</span>
          </div>
          <div className="rounded-lg bg-surface p-2">
            <p className="text-[7px] font-semibold tracking-wider text-slate-500 uppercase">Customers will pay</p>
            {[
              ['1 hour', '1,500'],
              ['2 hours', '3,000'],
              ['4 hours', '6,000'],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between py-0.5 text-[8.5px]">
                <span className="text-slate-500">{l}</span>
                <span className="font-semibold text-ink">Rs {v}</span>
              </div>
            ))}
          </div>
        </Card>
        <Btn>Add service</Btn>
      </div>
    </div>
  )
}

function ProviderComplete() {
  return (
    <div className="h-full bg-surface">
      <StatusBar />
      <AppBar bg="bg-surface" />
      <div className="px-3.5">
        <div className="mb-2 flex rounded-lg bg-slate-200/70 p-0.5 text-[8.5px] font-semibold">
          <span className="flex-1 py-1 text-center text-slate-500">New</span>
          <span className="flex-1 rounded-md bg-white py-1 text-center text-ink shadow-sm">Upcoming · 3</span>
          <span className="flex-1 py-1 text-center text-slate-500">History</span>
        </div>
        <Card className="p-2.5">
          <div className="flex items-center gap-2">
            <Tile icon={ChefHat} bg={svc.cook.bg} fg={svc.cook.fg} />
            <div className="flex-1">
              <p className="text-[10px] font-bold text-ink">Cook · 2 hrs</p>
              <p className="text-[7.5px] text-slate-500">Kashaf · House 12, DHA</p>
            </div>
            <Badge tone="sky">● Confirmed</Badge>
          </div>
          <Btn className="mt-2.5">
            <CircleCheck className="size-3" /> Mark job as completed
          </Btn>
        </Card>
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-ink p-2.5 text-white shadow-lg">
          <span className="flex size-7 items-center justify-center rounded-full bg-emerald-500/20">
            <Sparkles className="size-3.5 text-emerald-300" />
          </span>
          <div className="flex-1">
            <p className="text-[9px] font-bold">Rs 3,000 added to your wallet</p>
            <p className="text-[7.5px] text-slate-300">Booking #128 · just now</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ wallet */

function WalletBalance({ amount, provider }: { amount: string; provider?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-brand-700 to-brand-500 p-3 text-white shadow-[0_10px_24px_-8px_rgba(11,99,88,.6)]">
      <div className="absolute -top-8 -right-6 size-20 rounded-full bg-white/10" />
      <p className="flex items-center gap-1 text-[8px] font-semibold text-brand-100">
        <Wallet className="size-2.5" /> Eizi Wallet · available
      </p>
      <p className="mt-1 text-[22px] font-extrabold tracking-tight">{amount}</p>
      <Btn light className="mt-2">
        {provider ? (
          <>
            <ArrowUpRight className="size-3" /> Withdraw
          </>
        ) : (
          <>
            <ArrowDownLeft className="size-3" /> Add money
          </>
        )}
      </Btn>
    </div>
  )
}

function TxRow({ icon: Icon, t, s, amt, credit }: { icon: LucideIcon; t: string; s: string; amt: string; credit?: boolean }) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-2">
      <span className={`flex size-6 items-center justify-center rounded-full ${credit ? 'bg-emerald-50' : 'bg-slate-100'}`}>
        <Icon className={`size-3 ${credit ? 'text-emerald-600' : 'text-slate-500'}`} />
      </span>
      <div className="flex-1">
        <p className="text-[9px] font-semibold text-ink">{t}</p>
        <p className="text-[7px] text-slate-500">{s}</p>
      </div>
      <p className={`text-[9px] font-bold ${credit ? 'text-emerald-700' : 'text-ink'}`}>{amt}</p>
    </div>
  )
}

function ProviderWallet() {
  return (
    <div className="h-full bg-surface">
      <StatusBar />
      <AppBar bg="bg-surface" />
      <div className="space-y-2 px-3.5">
        <WalletBalance amount="Rs 12,500" provider />
        <p className="text-[10px] font-bold text-ink">History</p>
        <Card className="divide-y divide-slate-100">
          <TxRow icon={Banknote} t="Job earning" s="Booking #128 · today" amt="+ Rs 3,000" credit />
          <TxRow icon={Banknote} t="Job earning" s="Booking #121 · yesterday" amt="+ Rs 4,500" credit />
          <TxRow icon={ArrowUpRight} t="Withdrawal" s="JazzCash · 2 days ago" amt="− Rs 5,000" />
        </Card>
      </div>
    </div>
  )
}

const METHODS = [
  { k: 'EP', n: 'EasyPaisa', bg: '#E8F7EE', fg: '#13A04A' },
  { k: 'JC', n: 'JazzCash', bg: '#FDECEA', fg: '#D9261C' },
  { k: 'SP', n: 'SadaPay', bg: '#E6F7F6', fg: '#0F9D94' },
  { k: 'NP', n: 'NayaPay', bg: '#EEEAFD', fg: '#5B3FD9' },
]

function AddMoney() {
  return (
    <div className="h-full bg-surface">
      <StatusBar />
      <AppBar title="Add money" back bg="bg-surface" />
      <div className="space-y-2 px-3.5">
        <Card className="flex items-center gap-2 p-2.5 opacity-70">
          <Tile icon={Banknote} bg="#f1f5f9" fg="#64748b" size={24} />
          <div className="flex-1">
            <p className="text-[9.5px] font-bold text-ink">Pay online</p>
            <p className="text-[7px] text-slate-500">Card & bank transfer</p>
          </div>
          <Badge tone="violet">Coming soon</Badge>
        </Card>
        <Card className="p-2.5">
          <p className="text-[10px] font-bold text-ink">Pay manually</p>
          <p className="text-[7.5px] text-slate-500">Send from your mobile wallet</p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {METHODS.map((m, i) => (
              <div key={m.k} className={`flex items-center gap-1.5 rounded-lg border-2 p-1.5 ${i === 0 ? 'border-brand-600 bg-brand-50' : 'border-line bg-white'}`}>
                <span className="flex size-6 items-center justify-center rounded-full text-[7.5px] font-extrabold" style={{ background: m.bg, color: m.fg }}>
                  {m.k}
                </span>
                <div>
                  <p className="text-[8.5px] font-bold text-ink">{m.n}</p>
                  <p className="text-[6.5px] text-slate-500">Manual</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-2.5">
          <p className="text-[10px] font-bold text-ink">1. Send money to Eizi</p>
          <div className="mt-1.5 rounded-lg bg-surface p-2">
            <p className="text-[7px] font-semibold tracking-wider text-slate-500 uppercase">EasyPaisa account</p>
            <div className="mt-0.5 flex items-center justify-between">
              <p className="text-[12px] font-extrabold tracking-wide text-ink">03003209005</p>
              <span className="flex items-center gap-1 rounded-md bg-brand-700 px-1.5 py-1 text-[7.5px] font-bold text-white">
                <Copy className="size-2.5" /> Copy
              </span>
            </div>
            <p className="text-[7.5px] text-slate-600">Account title: Ali Raza</p>
          </div>
        </Card>
      </div>
    </div>
  )
}

function EnterTid() {
  return (
    <div className="flex h-full flex-col bg-surface">
      <StatusBar />
      <AppBar title="Add money" back bg="bg-surface" />
      <div className="flex-1 space-y-2 px-3.5">
        <Card className="space-y-2 p-2.5">
          <p className="text-[10px] font-bold text-ink">2. Tell us what you sent</p>
          <div className="flex gap-1">
            {['500', '1,000', '2,000', '5,000'].map((a) => (
              <span key={a} className={`flex-1 rounded-md py-1 text-center text-[7.5px] font-bold ${a === '5,000' ? 'bg-brand-700 text-white' : 'border border-line bg-white text-ink'}`}>
                Rs {a}
              </span>
            ))}
          </div>
          <div>
            <p className="mb-0.5 text-[7.5px] font-semibold text-slate-600">Amount sent</p>
            <div className="flex h-7 items-center rounded-md border border-line bg-white px-2 text-[9px]">
              <span className="font-semibold text-slate-500">Rs</span>
              <span className="ml-1.5 font-bold text-ink">5000</span>
            </div>
          </div>
          <div>
            <p className="mb-0.5 text-[7.5px] font-semibold text-slate-600">Transaction ID (TID)</p>
            <div className="flex h-7 items-center rounded-md border-2 border-brand-500 bg-white px-2 text-[9px] font-semibold text-ink shadow-[0_0_0_3px_rgba(20,145,127,.12)]">
              2847561930
            </div>
            <p className="mt-0.5 text-[7px] text-slate-500">From your EasyPaisa receipt / SMS</p>
          </div>
        </Card>
        <div className="flex gap-1.5 rounded-lg bg-brand-50 p-2 text-[7.5px] leading-snug text-brand-800">
          <Hourglass className="size-3 shrink-0 text-brand-600" /> Our team verifies every transfer before adding it to your balance.
        </div>
      </div>
      <div className="rounded-t-2xl bg-white px-3.5 pt-2.5 pb-5 shadow-[0_-6px_20px_rgba(15,23,42,.08)]">
        <Btn>
          <CircleCheck className="size-3" /> Submit Rs 5,000
        </Btn>
      </div>
    </div>
  )
}

function Verifying() {
  return (
    <div className="h-full bg-surface">
      <StatusBar />
      <AppBar bg="bg-surface" />
      <div className="space-y-2 px-3.5">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-brand-700 to-brand-500 p-3 text-white shadow-lg">
          <p className="text-[8px] font-semibold text-brand-100">Eizi Wallet · available</p>
          <p className="mt-1 text-[22px] font-extrabold">Rs 0</p>
          <p className="text-[8px] text-brand-100">+ Rs 5,000 waiting for verification</p>
        </div>
        <p className="text-[10px] font-bold text-ink">Requests</p>
        <Card className="flex items-center gap-2 p-2.5">
          <span className="flex size-7 items-center justify-center rounded-full text-[8px] font-extrabold" style={{ background: METHODS[0].bg, color: METHODS[0].fg }}>
            EP
          </span>
          <div className="flex-1">
            <p className="text-[9px] font-semibold text-ink">Add money · Rs 5,000</p>
            <p className="text-[7px] text-slate-500">TID 2847561930 · just now</p>
          </div>
          <Badge tone="amber">Verifying</Badge>
        </Card>
        <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/70 p-2.5">
          <p className="flex items-center gap-1 text-[8.5px] font-bold text-amber-800">
            <ShieldCheck className="size-3" /> Eizi team check
          </p>
          <p className="mt-0.5 text-[7.5px] leading-snug text-amber-900">Our team matches TID 2847561930 with the EasyPaisa statement and adds the money to your wallet.</p>
        </div>
      </div>
    </div>
  )
}

function BalanceUpdated() {
  return (
    <div className="h-full bg-surface">
      <StatusBar />
      <AppBar bg="bg-surface" />
      <div className="space-y-2 px-3.5">
        <WalletBalance amount="Rs 5,000" />
        <p className="text-[10px] font-bold text-ink">History</p>
        <Card className="divide-y divide-slate-100">
          <TxRow icon={ArrowDownLeft} t="Money added" s="Top-up via EasyPaisa · now" amt="+ Rs 5,000" credit />
          <TxRow icon={RotateCcw} t="Refund" s="Booking #119 cancelled" amt="+ Rs 1,500" credit />
          <TxRow icon={Wallet} t="Booking payment" s="Booking #119" amt="− Rs 1,500" />
        </Card>
      </div>
    </div>
  )
}

const SCREENS: Record<ScreenId, () => ReactNode> = {
  splash: Splash,
  signup: Signup,
  home: Home,
  providers: Providers,
  book: Book,
  pay: Pay,
  bookings: Bookings,
  'p-dashboard': ProviderDashboard,
  'p-services': ProviderServices,
  'p-complete': ProviderComplete,
  'p-wallet': ProviderWallet,
  'w-add': AddMoney,
  'w-tid': EnterTid,
  'w-verifying': Verifying,
  'w-balance': BalanceUpdated,
}
