import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  HandCoins,
  HardHat,
  House,
  Pause,
  Play,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { DownloadButton, FeatureCard, Section, TextLink, usePageMeta } from '../bits'
import { Phone } from '../phone/Phone'
import { Screen, type ScreenId } from '../phone/screens'
import { resolveIcon } from '../../lib/serviceIcons'
import { missingConfig, supabase } from '../../lib/supabase'

/* ------------------------------------------------------------------ content */

type FlowKey = 'customer' | 'provider' | 'wallet'
type Step = { screen: ScreenId; title: string; text: string; tip?: string }

const FLOWS: Record<FlowKey, { label: string; short: string; icon: LucideIcon; intro: string; steps: Step[] }> = {
  customer: {
    label: 'Book a service',
    short: 'Customer',
    icon: House,
    intro: 'From opening the app to a confirmed booking — usually in under a minute.',
    steps: [
      { screen: 'splash', title: 'Open Eizi', text: 'A quick, friendly start — your account is remembered, so you land right on your home screen.' },
      { screen: 'signup', title: 'Create your account', text: 'Choose “Customer” once when you sign up. Next time you just log in and you’re home.' },
      { screen: 'home', title: 'Find what you need', text: 'Search or browse services grouped by Cleaning, Repairs and Daily help — each card shows the starting price per hour.', tip: 'Prices are set by the pros themselves — compare and choose.' },
      { screen: 'providers', title: 'Compare pros', text: 'See every available professional with their hourly rate, photo and short bio, cheapest first.' },
      { screen: 'book', title: 'Pick hours, day & time', text: 'Choose 1 to 12 hours, a day and a start time, and add your address. The total updates as you go.', tip: 'No hidden charges — rate × hours, shown before you confirm.' },
      { screen: 'pay', title: 'Choose how to pay', text: 'Pay cash to the pro after the job, or pay from your Eizi wallet in one tap.', tip: 'Wallet payments are held safely until the job is done.' },
      { screen: 'bookings', title: 'Track your booking', text: 'Watch it go from Pending to Confirmed to Completed. Call your pro, or cancel before it starts.' },
    ],
  },
  provider: {
    label: 'Earn as a pro',
    short: 'Provider',
    icon: HardHat,
    intro: 'Set your own price, choose the jobs you want and get paid into your wallet.',
    steps: [
      { screen: 'p-services', title: 'Add your service & price', text: 'Pick what you do — cooking, cleaning, electrical, AC and more — and set your price per hour.', tip: 'Ready-made descriptions help you get listed in seconds.' },
      { screen: 'p-dashboard', title: 'Get booking requests', text: 'New requests appear on your dashboard with a notification. Accept the ones that suit you.' },
      { screen: 'p-complete', title: 'Do the job, mark it done', text: 'After the work, tap “Mark job as completed”. Wallet-paid jobs are credited to you instantly.' },
      { screen: 'p-wallet', title: 'Withdraw your earnings', text: 'Request a payout to EasyPaisa, JazzCash, SadaPay or NayaPay whenever you like (from Rs 500).' },
    ],
  },
  wallet: {
    label: 'Wallet & payments',
    short: 'Wallet',
    icon: Wallet,
    intro: 'Add money from the mobile wallet you already use. Online card payments are coming soon.',
    steps: [
      { screen: 'w-add', title: 'Choose a method', text: 'EasyPaisa, JazzCash, SadaPay or NayaPay — copy Eizi’s account number with one tap.' },
      { screen: 'w-tid', title: 'Send & share the TID', text: 'Transfer from your app, then enter the amount and the transaction ID (TID) from your receipt.' },
      { screen: 'w-verifying', title: 'We verify it', text: 'Our team matches your TID with our statement — every transfer is checked by a person.', tip: 'Each TID can only be used once, so nobody can claim your payment.' },
      { screen: 'w-balance', title: 'Your balance is ready', text: 'The money appears in your wallet with a full history of every top-up, payment and refund.' },
      { screen: 'pay', title: 'Pay in one tap', text: 'Use your balance at checkout. Cancelled or declined? It comes straight back to your wallet.' },
    ],
  },
}

const FALLBACK_SERVICES = [
  ['House Cleaner', 'broom', 'Sweeping, mopping, dusting and tidying'],
  ['Cook', 'chef-hat', 'Home-cooked meals prepared in your kitchen'],
  ['Electrician', 'flash', 'Wiring, switches, fans, lights and repairs'],
  ['Plumber', 'pipe-wrench', 'Leaks, taps, drains and fittings'],
  ['AC Technician', 'air-conditioner', 'AC service, gas refill and repair'],
  ['Dishwasher', 'dishwasher', 'Dishes washed, kitchen sink cleared'],
  ['Laundry', 'washing-machine', 'Washing, drying and ironing clothes'],
  ['Carpenter', 'saw-blade', 'Furniture repair, doors and woodwork'],
  ['Painter', 'format-paint', 'Walls, doors and touch-ups'],
  ['Babysitter', 'baby-face-outline', 'Trusted childcare at home'],
  ['Driver', 'car-outline', 'Personal driver for your own car'],
  ['Gardener', 'flower-outline', 'Lawn, plants and garden upkeep'],
].map(([name, icon, description], i) => ({ id: i + 1, name, icon, description, image_url: null as string | null }))

type Svc = (typeof FALLBACK_SERVICES)[number]

const TINTS = ['#E6F6F2', '#FFF3E0', '#EEF2FF', '#FDECF2', '#E7F3FE', '#F3EEFD']
const FG = ['#0B6358', '#B45309', '#4338CA', '#BE185D', '#1D4ED8', '#6D28D9']

const FAQ = [
  ['How is the price calculated?', 'Every pro sets an hourly rate. You choose how many hours you need, and Eizi shows the total (rate × hours) before you confirm — no hidden charges.'],
  ['Do I have to pay in advance?', 'No. You can pay cash to the pro after the job. If you prefer, pay from your Eizi wallet — the money is held safely and only released when the job is completed.'],
  ['What if I need to cancel?', 'You can cancel a pending or confirmed booking from the app before it starts. Wallet payments are refunded to your wallet instantly.'],
  ['How do I add money to my wallet?', 'Send money from EasyPaisa, JazzCash, SadaPay or NayaPay to Eizi’s account shown in the app, then enter the transaction ID. Our team verifies it and adds it to your balance.'],
  ['How can I work as a provider on Eizi?', 'Download the app, sign up as a Provider, add the services you offer with your hourly price, and start accepting requests. Your earnings can be withdrawn to your mobile wallet.'],
  ['Is the app available on iPhone?', 'Eizi is available for Android today. Get in touch if you’d like to know when the iPhone version is ready.'],
]

/* ------------------------------------------------------------------ page */

export function Home() {
  usePageMeta(
    'Eizi — Home services, booked by the hour',
    'Book cooks, cleaners, electricians, plumbers, AC technicians and more by the hour. See the price upfront, pay cash or from your Eizi wallet.',
  )
  const [services, setServices] = useState<Svc[]>(FALLBACK_SERVICES)

  // Live catalogue (same list the app shows); falls back to the default list if offline.
  useEffect(() => {
    if (missingConfig) return
    supabase
      .from('services')
      .select('id, name, icon, description, image_url')
      .order('name')
      .then(({ data }) => {
        if (data && data.length) setServices(data as Svc[])
      })
  }, [])

  return (
    <>
      <Hero />
      <TrustBar />

      <Section id="services" eyebrow="Services" title="Help for every corner of your home" intro="Book trusted pros for everyday chores and repairs — by the hour, at the price they set." center>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {services.map((s) => {
            const { Icon } = resolveIcon(s)
            return (
              <div key={s.id} className="group rounded-3xl border border-slate-200/70 bg-white p-5 shadow-card transition hover:-translate-y-1 hover:shadow-pop">
                <div className="flex h-20 items-center">
                  <span className="relative flex h-20 w-28 items-center justify-center rounded-[40%]" style={{ background: TINTS[s.id % TINTS.length] }}>
                    {s.image_url ? (
                      <img src={s.image_url} alt="" loading="lazy" className="h-20 w-28 object-contain transition group-hover:scale-110" />
                    ) : (
                      <Icon className="size-9 transition group-hover:scale-110" style={{ color: FG[s.id % FG.length] }} />
                    )}
                  </span>
                </div>
                <h3 className="mt-4 font-bold text-ink">{s.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">{s.description}</p>
              </div>
            )
          })}
        </div>
      </Section>

      <Tour />

      <Section eyebrow="Why Eizi" title="Simple, fair and safe" intro="Everything is designed so you know what you’ll pay and who is coming — before you book." className="bg-white" center>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard icon={Clock} title="Pay by the hour" text="Book exactly the time you need — 1 hour or a full day. The total is shown before you confirm." />
          <FeatureCard icon={ReceiptText} tone="amber" title="Prices up front" text="Pros set their own hourly rates and you compare them side by side. No surprises at the door." />
          <FeatureCard icon={HandCoins} tone="blue" title="Cash or wallet" text="Pay cash after the job, or one-tap from your Eizi wallet topped up via EasyPaisa, JazzCash and more." />
          <FeatureCard icon={ShieldCheck} title="Money held safely" text="Wallet payments are only released to the pro after the job is marked completed." />
          <FeatureCard icon={RotateCcw} tone="violet" title="Instant refunds" text="Cancel before it starts or if a pro declines — wallet payments come straight back." />
          <FeatureCard icon={BadgeCheck} tone="amber" title="Know your pro" text="See each pro’s photo, bio and rate, and call them directly once your booking is confirmed." />
        </div>
      </Section>

      <WalletBand />
      <Providers />
      <Faq />
      <DownloadCta />
    </>
  )
}

/* ------------------------------------------------------------------ sections */

function Hero() {
  return (
    <section className="px-3 pt-3 sm:px-5">
      <div className="relative mx-auto max-w-[88rem] overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 px-6 py-14 shadow-pop sm:px-10 lg:px-14 lg:py-20">
        <div className="absolute -top-32 -right-24 size-[28rem] rounded-full bg-white/5" />
        <div className="absolute -bottom-40 -left-20 size-96 rounded-full bg-brand-500/20 blur-2xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_42%,rgba(63,174,156,.38),transparent_55%)]" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-brand-100 ring-1 ring-white/15">
              <Sparkles className="size-3.5" /> Home services · booked by the hour
            </span>
            <h1 className="text-shine mt-5 text-[2.6rem] leading-[1.05] font-black tracking-tight sm:text-6xl">
              Ghar ki har service,
              <br />
              ek tap door.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-brand-100/90">
              Cooks, cleaners, electricians, plumbers, AC technicians and more. Pick the hours you need, see the price upfront, and pay cash or from your Eizi wallet.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <DownloadButton size="lg" variant="light" />
              <a
                href="#how-it-works"
                className="inline-flex h-14 items-center gap-2 rounded-xl bg-white/10 px-6 text-base font-bold text-white ring-1 ring-white/25 transition hover:bg-white/20"
              >
                See how it works <ArrowRight className="size-4" />
              </a>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-brand-100">
              {['Price before you book', 'Cash or wallet', 'Instant refunds'].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <BadgeCheck className="size-4 text-brand-300" /> {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative flex h-[440px] items-center justify-center sm:h-[500px]">
            <Phone width={172} tilt={{ x: 8, y: 28 }} float floatDelay={600} className="absolute left-[2%] hidden translate-y-6 opacity-90 md:block" label="Eizi home screen">
              <Screen id="home" />
            </Phone>
            <Phone width={172} tilt={{ x: 8, y: -28 }} float floatDelay={1200} className="absolute right-[2%] hidden translate-y-6 opacity-90 md:block" label="Eizi wallet screen">
              <Screen id="w-balance" />
            </Phone>
            <Phone width={216} tilt={{ x: 4, y: 0 }} float interactive className="relative z-10" label="Eizi checkout screen">
              <Screen id="pay" />
            </Phone>
          </div>
        </div>
      </div>
    </section>
  )
}

function TrustBar() {
  const items: [LucideIcon, string, string][] = [
    [Smartphone, '12+', 'home services'],
    [Clock, '1–12 hrs', 'book exactly what you need'],
    [Wallet, '4', 'mobile wallets supported'],
    [CalendarCheck, '7 days', 'book up to a week ahead'],
  ]
  return (
    <div className="mx-auto -mt-1 max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
      <div className="grid grid-cols-2 gap-4 rounded-3xl border border-slate-200/70 bg-white p-5 shadow-card md:grid-cols-4 md:p-6">
        {items.map(([Icon, v, l]) => (
          <div key={l} className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
              <Icon className="size-5" />
            </span>
            <div>
              <p className="text-lg font-extrabold text-ink">{v}</p>
              <p className="text-xs text-slate-500">{l}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const AUTOPLAY_MS = 4800

function Tour() {
  const [flow, setFlow] = useState<FlowKey>('customer')
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(() => !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  const ref = useRef<HTMLElement>(null)
  const steps = FLOWS[flow].steps
  const step = steps[index]

  useEffect(() => {
    if (!playing) return
    const t = setTimeout(() => setIndex((i) => (i + 1) % steps.length), AUTOPLAY_MS)
    return () => clearTimeout(t)
  }, [playing, index, steps.length])

  const go = (d: number) => {
    setPlaying(false)
    setIndex((i) => (i + d + steps.length) % steps.length)
  }

  return (
    <section id="how-it-works" ref={ref} className="scroll-mt-24 bg-gradient-to-b from-white to-surface py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-bold tracking-[0.18em] text-brand-600 uppercase">How it works</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">See the app, step by step</h2>
            <p className="mt-3 text-base leading-7 text-slate-600 sm:text-lg">{FLOWS[flow].intro}</p>
          </div>
          <div className="inline-flex self-start rounded-2xl bg-white p-1.5 shadow-card ring-1 ring-slate-200/70 lg:self-auto" role="tablist">
            {(Object.keys(FLOWS) as FlowKey[]).map((k) => {
              const F = FLOWS[k]
              const on = k === flow
              return (
                <button
                  key={k}
                  role="tab"
                  aria-selected={on}
                  onClick={() => {
                    setFlow(k)
                    setIndex(0)
                  }}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition sm:px-4 ${on ? 'bg-brand-700 text-white shadow-brand' : 'text-slate-500 hover:text-ink'}`}
                >
                  <F.icon className="size-4" />
                  <span className="hidden sm:inline">{F.label}</span>
                  <span className="sm:hidden">{F.short}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:gap-14">
          <ol className="order-2 space-y-3 lg:order-1">
            {steps.map((s, i) => {
              const on = i === index
              const done = i < index
              return (
                <li key={s.title}>
                  <button
                    onClick={() => {
                      setPlaying(false)
                      setIndex(i)
                    }}
                    aria-current={on ? 'step' : undefined}
                    className={`relative w-full cursor-pointer overflow-hidden rounded-2xl p-4 text-left transition sm:p-5 ${on ? 'bg-white shadow-pop ring-1 ring-brand-200' : 'bg-white/60 ring-1 ring-slate-200/70 hover:bg-white hover:shadow-card'}`}
                  >
                    {on && playing ? (
                      <span key={`${flow}-${index}`} className="step-progress absolute inset-x-0 bottom-0 h-1 bg-brand-500/70" style={{ animationDuration: `${AUTOPLAY_MS}ms` }} />
                    ) : null}
                    <div className="flex gap-4">
                      <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition ${on ? 'bg-brand-700 text-white shadow-brand' : done ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`font-bold ${on ? 'text-ink' : 'text-slate-700'}`}>{s.title}</p>
                        <p className={`mt-1 text-sm leading-6 ${on ? 'text-slate-600' : 'line-clamp-1 text-slate-500'}`}>{s.text}</p>
                        {on && s.tip ? (
                          <p className="mt-3 inline-flex items-start gap-2 rounded-xl bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-800 ring-1 ring-brand-100">
                            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-brand-600" /> {s.tip}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ol>

          <div className="order-1 lg:order-2">
            <div className="lg:sticky lg:top-28">
              <div className="relative mx-auto w-fit rounded-[3rem] bg-gradient-to-b from-brand-50 to-transparent px-6 pt-8 sm:px-12">
                <div className="absolute inset-x-6 top-10 h-64 rounded-full bg-brand-300/30 blur-3xl" />
                <Phone width={280} tilt={{ x: 5, y: -12 }} interactive float label={`${step.title} — app screen`}>
                  <Screen key={`${flow}-${step.screen}-${index}`} id={step.screen} />
                </Phone>
              </div>
              <div className="mx-auto mt-2 flex w-fit items-center gap-2 rounded-2xl bg-white p-1.5 shadow-card ring-1 ring-slate-200/70">
                <CtrlBtn label="Previous step" onClick={() => go(-1)} icon={ChevronLeft} />
                <CtrlBtn label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying((p) => !p)} icon={playing ? Pause : Play} primary />
                <CtrlBtn label="Next step" onClick={() => go(1)} icon={ChevronRight} />
                <span className="px-2 text-xs font-semibold text-slate-500 tabular-nums">
                  {index + 1} / {steps.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function CtrlBtn({ label, onClick, icon: Icon, primary }: { label: string; onClick: () => void; icon: LucideIcon; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex size-10 cursor-pointer items-center justify-center rounded-xl transition ${primary ? 'bg-brand-700 text-white shadow-brand hover:bg-brand-800' : 'text-slate-600 hover:bg-slate-100'}`}
    >
      <Icon className="size-4" />
    </button>
  )
}

function WalletBand() {
  const methods = [
    { k: 'EP', n: 'EasyPaisa', bg: '#E8F7EE', fg: '#13A04A' },
    { k: 'JC', n: 'JazzCash', bg: '#FDECEA', fg: '#D9261C' },
    { k: 'SP', n: 'SadaPay', bg: '#E6F7F6', fg: '#0F9D94' },
    { k: 'NP', n: 'NayaPay', bg: '#EEEAFD', fg: '#5B3FD9' },
  ]
  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative grid items-center gap-10 overflow-hidden rounded-[2rem] bg-white p-8 shadow-pop ring-1 ring-slate-200/70 sm:p-12 lg:grid-cols-2">
          <div className="absolute -top-24 -right-24 size-80 rounded-full bg-brand-50" />
          <div className="relative">
            <p className="text-xs font-bold tracking-[0.18em] text-brand-600 uppercase">Eizi wallet</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Top up with the app you already use</h2>
            <p className="mt-3 text-base leading-7 text-slate-600 sm:text-lg">
              Add money from your mobile wallet, then pay for any booking in one tap. Every top-up is verified by our team, and every rupee is listed in your history.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {methods.map((m) => (
                <span key={m.k} className="inline-flex items-center gap-2 rounded-2xl bg-white py-2 pr-4 pl-2 shadow-card ring-1 ring-slate-200/70">
                  <span className="flex size-8 items-center justify-center rounded-full text-[11px] font-extrabold" style={{ background: m.bg, color: m.fg }}>
                    {m.k}
                  </span>
                  <span className="text-sm font-bold text-ink">{m.n}</span>
                </span>
              ))}
              <span className="inline-flex items-center gap-2 rounded-2xl bg-violet-50 px-4 py-2 text-sm font-bold text-violet-700 ring-1 ring-violet-200">Cards — coming soon</span>
            </div>
          </div>
          <div className="relative flex justify-center">
            <Phone width={230} tilt={{ x: 6, y: -16 }} float interactive label="Eizi add money screen">
              <Screen id="w-add" />
            </Phone>
          </div>
        </div>
      </div>
    </section>
  )
}

function Providers() {
  return (
    <section id="providers" className="scroll-mt-24 bg-brand-950 py-16 text-white sm:py-20">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div className="order-2 flex justify-center lg:order-1">
          <Phone width={240} tilt={{ x: 6, y: 16 }} float interactive label="Eizi provider dashboard">
            <Screen id="p-dashboard" />
          </Phone>
        </div>
        <div className="order-1 lg:order-2">
          <p className="text-xs font-bold tracking-[0.18em] text-brand-300 uppercase">For professionals</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Your skills. Your price. Your schedule.</h2>
          <p className="mt-3 text-base leading-7 text-brand-100/90 sm:text-lg">
            Join Eizi as a provider and get booking requests from customers near you. You decide your hourly rate and which jobs to accept.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              'Set your own hourly price for each service',
              'Accept or decline every request',
              'Wallet-paid jobs are credited the moment you finish',
              'Withdraw to EasyPaisa, JazzCash, SadaPay or NayaPay',
            ].map((t) => (
              <li key={t} className="flex items-start gap-3 text-[15px]">
                <BadgeCheck className="mt-0.5 size-5 shrink-0 text-brand-300" /> {t}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <DownloadButton variant="light" />
            <span className="text-sm text-brand-200">Sign up and choose “Provider”.</span>
          </div>
        </div>
      </div>
    </section>
  )
}

function Faq() {
  return (
    <Section eyebrow="FAQ" title="Questions, answered" center>
      <div className="mx-auto max-w-3xl space-y-3">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card open:shadow-pop">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-ink">
              {q}
              <ChevronDown className="size-5 shrink-0 text-slate-400 transition group-open:rotate-180" />
            </summary>
            <p className="mt-3 text-[15px] leading-7 text-slate-600">{a}</p>
          </details>
        ))}
      </div>
      <p className="mt-8 text-center text-slate-600">
        Still have a question? <TextLink to="/contact">Contact us</TextLink>
      </p>
    </Section>
  )
}

function DownloadCta() {
  return (
    <section id="download" className="scroll-mt-24 px-3 pb-16 sm:px-5 sm:pb-20">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-700 to-brand-500 px-6 py-14 text-center shadow-pop sm:px-12">
        <div className="absolute -top-20 -left-16 size-72 rounded-full bg-white/10" />
        <div className="absolute -right-10 -bottom-24 size-72 rounded-full bg-white/10" />
        <div className="relative">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Get Eizi on your phone</h2>
          <p className="mx-auto mt-3 max-w-xl text-lg text-brand-50">Book your first service in under a minute — or start earning as a pro.</p>
          <div className="mt-8 flex justify-center">
            <DownloadButton size="lg" variant="light" />
          </div>
          <p className="mt-4 text-sm text-brand-100">Android · free to download</p>
        </div>
      </div>
    </section>
  )
}
