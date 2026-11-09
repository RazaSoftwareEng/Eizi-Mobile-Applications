import { Eye, HandCoins, HeartHandshake, Lightbulb, ShieldCheck, Smile, Target, Users } from 'lucide-react'

import { Link } from 'react-router'

import { DownloadButton, FeatureCard, Section, TextLink, usePageMeta } from '../bits'
import { Phone } from '../phone/Phone'
import { Screen } from '../phone/screens'

export function About() {
  usePageMeta(
    'About Eizi — fair, simple home services',
    'Eizi makes booking help at home as easy as booking a ride: clear hourly prices, pros who set their own rates, and payments that are safe for everyone.',
  )

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pt-12 pb-16 sm:pt-16 sm:pb-20">
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-brand-100/60 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:px-8">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-brand-600 uppercase">About Eizi</p>
            <h1 className="mt-3 text-4xl leading-[1.08] font-black tracking-tight text-ink sm:text-5xl">
              Booking help at home should be as easy as booking a ride.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
              Finding a reliable cook, cleaner or electrician usually means phone calls, haggling and guesswork about the final bill. Eizi replaces all of that
              with a few taps: pick a service, choose your hours, see the price and book.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <DownloadButton />
              <TextLink to="/contact">Talk to us</TextLink>
            </div>
          </div>
          <div className="flex justify-center">
            <Phone width={250} tilt={{ x: 6, y: -16 }} float interactive label="Eizi home screen">
              <Screen id="home" />
            </Phone>
          </div>
        </div>
      </section>

      {/* Mission & vision */}
      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 md:grid-cols-2 lg:px-8">
          <Statement icon={Target} title="Our mission">
            Give every household quick access to trusted help — and give every skilled worker a fair, direct way to earn from their work.
          </Statement>
          <Statement icon={Eye} title="Our vision">
            A Pakistan where hiring help at home is transparent, safe and respectful for both sides, from the first tap to the final payment.
          </Statement>
        </div>
      </section>

      {/* Two sides */}
      <Section eyebrow="Built for both sides" title="Fair for customers. Fair for pros." center>
        <div className="grid gap-6 lg:grid-cols-2">
          <SideCard
            icon={Smile}
            title="For customers"
            points={[
              'Compare pros and their hourly rates before you book',
              'See the full price — rate × hours — upfront',
              'Pay cash after the job, or from your wallet',
              'Cancel before it starts; wallet payments refunded instantly',
            ]}
          />
          <SideCard
            icon={Users}
            dark
            title="For service providers"
            points={[
              'Set your own price for every service you offer',
              'Choose the jobs that fit your day',
              'Get paid for wallet bookings as soon as you finish',
              'Withdraw to the mobile wallet you already use',
            ]}
          />
        </div>
      </Section>

      {/* Values */}
      <Section eyebrow="What we stand for" title="Our values" className="bg-white" center>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard icon={Lightbulb} title="Clarity" text="Clear prices, clear steps and clear status updates — no fine print." />
          <FeatureCard icon={ShieldCheck} tone="blue" title="Safety" text="Money is held until the job is done, and every top-up is checked by a person." />
          <FeatureCard icon={HandCoins} tone="amber" title="Fairness" text="Pros keep control of their rates; customers only pay for the hours they book." />
          <FeatureCard icon={HeartHandshake} tone="violet" title="Respect" text="For people’s homes, time and work — on every single booking." />
        </div>
      </Section>

      {/* CTA */}
      <section className="px-3 py-16 sm:px-5 sm:py-20">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-950 to-brand-700 px-6 py-12 text-center shadow-pop sm:px-12">
          <div className="absolute -top-20 -right-16 size-72 rounded-full bg-white/5" />
          <h2 className="relative text-3xl font-extrabold tracking-tight text-white">Want to work with us or list your team?</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-brand-100">We’d love to hear from service providers, agencies and partners.</p>
          <div className="relative mt-7 flex flex-wrap justify-center gap-3">
            <DownloadButton variant="light" />
            <Link to="/contact?topic=business" className="inline-flex h-12 items-center rounded-xl bg-white/10 px-5 font-bold text-white ring-1 ring-white/25 transition hover:bg-white/20">
              Partner with Eizi
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}

function Statement({ icon: Icon, title, children }: { icon: typeof Target; title: string; children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-50 to-white p-8 shadow-card ring-1 ring-brand-100">
      <div className="absolute -top-10 -right-10 size-32 rounded-full bg-brand-100/70" />
      <span className="relative flex size-12 items-center justify-center rounded-2xl bg-brand-700 text-white shadow-brand">
        <Icon className="size-6" />
      </span>
      <h2 className="relative mt-5 text-2xl font-extrabold tracking-tight text-ink">{title}</h2>
      <p className="relative mt-2 text-lg leading-8 text-slate-600">{children}</p>
    </div>
  )
}

function SideCard({ icon: Icon, title, points, dark }: { icon: typeof Smile; title: string; points: string[]; dark?: boolean }) {
  return (
    <div className={`rounded-3xl p-8 shadow-pop ${dark ? 'bg-brand-950 text-white' : 'bg-white ring-1 ring-slate-200/70'}`}>
      <span className={`flex size-12 items-center justify-center rounded-2xl ${dark ? 'bg-white/10 text-brand-200' : 'bg-brand-50 text-brand-700'}`}>
        <Icon className="size-6" />
      </span>
      <h3 className={`mt-5 text-2xl font-extrabold tracking-tight ${dark ? 'text-white' : 'text-ink'}`}>{title}</h3>
      <ul className="mt-5 space-y-3">
        {points.map((p) => (
          <li key={p} className={`flex items-start gap-3 text-[15px] ${dark ? 'text-brand-100' : 'text-slate-600'}`}>
            <ShieldCheck className={`mt-0.5 size-5 shrink-0 ${dark ? 'text-brand-300' : 'text-brand-600'}`} /> {p}
          </li>
        ))}
      </ul>
    </div>
  )
}
