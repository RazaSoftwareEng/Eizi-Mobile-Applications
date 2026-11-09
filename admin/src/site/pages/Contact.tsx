import { CircleCheck, Clock, Loader2, Mail, MessageCircle, Phone, Send } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'

import { usePageMeta } from '../bits'
import { config, prettyPhone } from '../config'
import { missingConfig, supabase } from '../../lib/supabase'

const TOPICS = [
  { value: 'general', label: 'General question' },
  { value: 'app', label: 'Getting the app' },
  { value: 'provider', label: 'Joining as a provider' },
  { value: 'support', label: 'Help with a booking or wallet' },
  { value: 'business', label: 'Partnership / business' },
] as const
type Topic = (typeof TOPICS)[number]['value']

const field =
  'w-full rounded-xl border border-line bg-white px-4 text-[15px] text-ink shadow-sm transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 focus:outline-none'

export function Contact() {
  usePageMeta('Contact Eizi', 'Questions about bookings, the wallet or joining as a provider? Send us a message, call or WhatsApp the Eizi team.')
  const [params] = useSearchParams()
  const initialTopic = (TOPICS.find((t) => t.value === params.get('topic'))?.value ?? 'general') as Topic

  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [topic, setTopic] = useState<Topic>(initialTopic)
  const [message, setMessage] = useState(initialTopic === 'app' ? 'Please send me the link to download the Eizi Android app.' : '')
  const [website, setWebsite] = useState('') // honeypot — real people never fill this
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (website) return setState('sent') // silently drop bots
    if (name.trim().length < 2) return setError('Please enter your name.')
    if (contact.trim().length < 5) return setError('Please enter a phone number or email so we can reply.')
    if (message.trim().length < 10) return setError('Please write a little more (at least 10 characters).')
    if (missingConfig) return setError('The form is not available right now — please call or WhatsApp us instead.')

    setState('sending')
    const { error: err } = await supabase.from('contact_messages').insert({
      name: name.trim(),
      contact: contact.trim(),
      topic,
      message: message.trim(),
    })
    if (err) {
      setState('idle')
      return setError(err.message.includes('Too many') ? err.message : 'Sorry, something went wrong. Please try again or contact us by phone.')
    }
    setState('sent')
  }

  return (
    <section className="relative overflow-hidden py-12 sm:py-16">
      <div className="absolute -top-24 -left-24 size-96 rounded-full bg-brand-100/60 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-bold tracking-[0.18em] text-brand-600 uppercase">Contact</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-ink sm:text-5xl">We’re here to help</h1>
          <p className="mt-4 text-lg leading-8 text-slate-600">Questions about a booking, your wallet or joining as a provider? Send us a message and we’ll get back to you.</p>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.35fr]">
          {/* Direct contact */}
          <div className="space-y-4">
            {config.phone ? (
              <ContactCard icon={Phone} title="Call us" value={prettyPhone(config.phone)} href={`tel:${config.phone}`} note="Mon–Sat, 9 am – 7 pm" />
            ) : null}
            {config.whatsapp ? (
              <ContactCard icon={MessageCircle} title="WhatsApp" value="Chat with the Eizi team" href={`https://wa.me/${config.whatsapp}`} note="Usually replies within a few hours" external tone="green" />
            ) : null}
            {config.email ? <ContactCard icon={Mail} title="Email" value={config.email} href={`mailto:${config.email}`} note="We reply within 1 business day" /> : null}
            <div className="flex items-start gap-3 rounded-3xl bg-brand-950 p-6 text-brand-100 shadow-pop">
              <Clock className="mt-0.5 size-5 shrink-0 text-brand-300" />
              <p className="text-sm leading-6">
                Wallet top-ups and withdrawals are checked by our team every day. If your top-up is still “Verifying” after a few hours, message us with your transaction
                ID (TID).
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="rounded-[2rem] bg-white p-6 shadow-pop ring-1 ring-slate-200/70 sm:p-8">
            {state === 'sent' ? (
              <div className="animate-pop-in flex flex-col items-center py-12 text-center">
                <span className="flex size-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <CircleCheck className="size-8" />
                </span>
                <h2 className="mt-5 text-2xl font-extrabold text-ink">Message sent — thank you!</h2>
                <p className="mt-2 max-w-sm text-slate-600">We’ve received your message and will reply on {contact.trim() || 'the contact you gave'}.</p>
                <button
                  onClick={() => {
                    setState('idle')
                    setMessage('')
                  }}
                  className="mt-6 cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={submit} noValidate className="space-y-5">
                <h2 className="text-xl font-extrabold text-ink">Send us a message</h2>
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">Your name</span>
                    <input className={`${field} h-12`} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} required />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">Phone or email</span>
                    <input
                      className={`${field} h-12`}
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      placeholder="03xx xxxxxxx or you@mail.com"
                      autoComplete="email"
                      maxLength={120}
                      required
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">Topic</span>
                  <select className={`${field} h-12 cursor-pointer`} value={topic} onChange={(e) => setTopic(e.target.value as Topic)}>
                    {TOPICS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 flex items-baseline justify-between text-[13px] font-semibold text-slate-700">
                    Message <span className="font-normal text-slate-400">{message.length}/2000</span>
                  </span>
                  <textarea className={`${field} min-h-36 py-3`} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} required />
                </label>
                {/* honeypot */}
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="absolute -left-[9999px] h-0 w-0 opacity-0"
                  aria-hidden="true"
                  name="website"
                />
                {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
                <button
                  type="submit"
                  disabled={state === 'sending'}
                  className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-700 font-bold text-white shadow-brand transition hover:-translate-y-0.5 hover:bg-brand-800 disabled:opacity-60 sm:w-auto sm:px-8"
                >
                  {state === 'sending' ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
                  {state === 'sending' ? 'Sending…' : 'Send message'}
                </button>
                <p className="text-xs text-slate-500">We only use your details to reply to this message.</p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function ContactCard({ icon: Icon, title, value, href, note, external, tone = 'brand' }: {
  icon: typeof Phone
  title: string
  value: string
  href: string
  note: string
  external?: boolean
  tone?: 'brand' | 'green'
}) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      className="group flex items-center gap-4 rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-pop"
    >
      <span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl transition group-hover:scale-110 ${tone === 'green' ? 'bg-green-50 text-green-700' : 'bg-brand-50 text-brand-700'}`}>
        <Icon className="size-6" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">{title}</p>
        <p className="truncate text-lg font-bold text-ink">{value}</p>
        <p className="text-xs text-slate-500">{note}</p>
      </div>
    </a>
  )
}
