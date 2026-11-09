import { ArrowRight, Download, type LucideIcon } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router'

import { config } from './config'

/** Sets <title> + meta description per page. */
// eslint-disable-next-line react-refresh/only-export-components
export function usePageMeta(title: string, description?: string) {
  useEffect(() => {
    document.title = title
    if (description) document.querySelector('meta[name="description"]')?.setAttribute('content', description)
  }, [title, description])
}

/** "Download for Android" — links to the APK when VITE_APK_URL is set, otherwise says it's coming soon. */
export function DownloadButton({ size = 'md', variant = 'primary', className = '' }: { size?: 'sm' | 'md' | 'lg'; variant?: 'primary' | 'light'; className?: string }) {
  const sizes = { sm: 'h-10 px-4 text-sm', md: 'h-12 px-5 text-[15px]', lg: 'h-14 px-7 text-base' }[size]
  const look =
    variant === 'light'
      ? 'bg-white text-brand-800 shadow-lg hover:shadow-xl'
      : 'bg-brand-700 text-white shadow-brand hover:bg-brand-800'
  const base = `inline-flex items-center justify-center gap-2 rounded-xl font-bold transition hover:-translate-y-0.5 ${sizes} ${look} ${className}`

  if (config.apkUrl) {
    return (
      <a href={config.apkUrl} className={base} target="_blank" rel="noreferrer">
        <Download className="size-[18px]" /> Download for Android
      </a>
    )
  }
  return (
    <Link to="/contact?topic=app" className={base} title="The public download link is coming soon — leave your number and we'll send it">
      <Download className="size-[18px]" /> Get the Android app
    </Link>
  )
}

export function Section({ id, eyebrow, title, intro, children, className = '', center }: {
  id?: string
  eyebrow?: string
  title: ReactNode
  intro?: ReactNode
  children: ReactNode
  className?: string
  center?: boolean
}) {
  return (
    <section id={id} className={`scroll-mt-24 py-16 sm:py-20 ${className}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className={`mb-10 max-w-2xl ${center ? 'mx-auto text-center' : ''}`}>
          {eyebrow ? <p className="text-xs font-bold tracking-[0.18em] text-brand-600 uppercase">{eyebrow}</p> : null}
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{title}</h2>
          {intro ? <p className="mt-3 text-base leading-7 text-slate-600 sm:text-lg">{intro}</p> : null}
        </div>
        {children}
      </div>
    </section>
  )
}

export function FeatureCard({ icon: Icon, title, text, tone = 'brand' }: { icon: LucideIcon; title: string; text: string; tone?: 'brand' | 'amber' | 'blue' | 'violet' }) {
  const t = { brand: 'bg-brand-50 text-brand-700', amber: 'bg-amber-50 text-amber-700', blue: 'bg-blue-50 text-blue-700', violet: 'bg-violet-50 text-violet-700' }[tone]
  return (
    <div className="group rounded-3xl border border-slate-200/70 bg-white p-6 shadow-card transition hover:-translate-y-1 hover:shadow-pop">
      <span className={`flex size-12 items-center justify-center rounded-2xl ${t} transition group-hover:scale-110`}>
        <Icon className="size-6" />
      </span>
      <h3 className="mt-5 text-lg font-bold text-ink">{title}</h3>
      <p className="mt-2 text-[15px] leading-6 text-slate-600">{text}</p>
    </div>
  )
}

export function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:gap-2.5 hover:underline">
      {children} <ArrowRight className="size-4 transition-all" />
    </Link>
  )
}
