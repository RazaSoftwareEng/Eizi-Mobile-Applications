import { Mail, Menu, MessageCircle, Phone, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'

import { config, prettyPhone } from './config'
import { DownloadButton } from './bits'

const YEAR = new Date().getFullYear()

const NAV = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
]

export function Logo({ light }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="Eizi home">
      <span className={`flex size-10 items-center justify-center rounded-xl text-lg font-black shadow-lg ${light ? 'bg-white text-brand-700' : 'bg-brand-700 text-white shadow-brand'}`}>
        E
      </span>
      <span className={`text-xl font-extrabold tracking-tight ${light ? 'text-white' : 'text-ink'}`}>Eizi</span>
    </Link>
  )
}

export function Layout() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { pathname, hash } = useLocation()

  // New page → start at the top (or at the #section that was linked).
  useEffect(() => {
    if (hash) document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' })
    else window.scrollTo({ top: 0 })
  }, [pathname, hash])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="flex min-h-full flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-pop">
        Skip to content
      </a>

      <header className={`sticky top-0 z-50 transition ${scrolled ? 'border-b border-slate-200/70 bg-white/85 shadow-sm backdrop-blur-lg' : 'bg-surface/70 backdrop-blur'}`}>
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) =>
                  `rounded-xl px-4 py-2 text-[15px] font-semibold transition ${isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100 hover:text-ink'}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden md:block">
            <DownloadButton size="sm" />
          </div>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            className="cursor-pointer rounded-xl p-2 text-ink hover:bg-slate-100 md:hidden"
          >
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>

        {open ? (
          <div className="animate-fade-in border-t border-slate-200/70 bg-white px-4 pb-5 shadow-pop md:hidden">
            <nav className="flex flex-col py-2" aria-label="Mobile">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === '/'}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) => `rounded-xl px-3 py-3 text-base font-semibold ${isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-700'}`}
                >
                  {n.label}
                </NavLink>
              ))}
            </nav>
            <DownloadButton className="w-full" />
          </div>
        ) : null}
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <Footer />
    </div>
  )
}

function Footer() {
  return (
    <footer className="relative overflow-hidden bg-brand-950 text-brand-100">
      <div className="absolute -top-40 -right-32 size-96 rounded-full bg-white/[0.03]" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div>
          <Logo light />
          <p className="mt-4 max-w-sm text-sm leading-6 text-brand-200/90">
            Ghar ki har service, ek tap door. Book cooks, cleaners, electricians and more by the hour — with the price shown before you book.
          </p>
          <div className="mt-5">
            <DownloadButton size="sm" variant="light" />
          </div>
        </div>
        <div>
          <p className="text-sm font-bold tracking-wider text-white uppercase">Explore</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link className="hover:text-white" to="/">Home</Link></li>
            <li><Link className="hover:text-white" to="/#how-it-works">How it works</Link></li>
            <li><Link className="hover:text-white" to="/#services">Services</Link></li>
            <li><Link className="hover:text-white" to="/#providers">Become a provider</Link></li>
            <li><Link className="hover:text-white" to="/about">About us</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-bold tracking-wider text-white uppercase">Get in touch</p>
          <ul className="mt-4 space-y-3 text-sm">
            {config.phone ? (
              <li>
                <a className="inline-flex items-center gap-2 hover:text-white" href={`tel:${config.phone}`}>
                  <Phone className="size-4" /> {prettyPhone(config.phone)}
                </a>
              </li>
            ) : null}
            {config.whatsapp ? (
              <li>
                <a className="inline-flex items-center gap-2 hover:text-white" href={`https://wa.me/${config.whatsapp}`} target="_blank" rel="noreferrer">
                  <MessageCircle className="size-4" /> WhatsApp us
                </a>
              </li>
            ) : null}
            {config.email ? (
              <li>
                <a className="inline-flex items-center gap-2 hover:text-white" href={`mailto:${config.email}`}>
                  <Mail className="size-4" /> {config.email}
                </a>
              </li>
            ) : null}
            <li>
              <Link className="font-semibold text-white underline-offset-4 hover:underline" to="/contact">
                Send us a message →
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-brand-300 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {YEAR} Eizi. All rights reserved.</p>
          <p>Made in Pakistan · Android app</p>
        </div>
      </div>
    </footer>
  )
}
