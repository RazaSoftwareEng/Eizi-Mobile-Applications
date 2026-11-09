import { createClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim()

/**
 * True when the build has no Supabase settings (e.g. env vars not added on Vercel).
 * main.tsx shows a setup screen instead of a blank page.
 */
export const missingConfig = !url || !key

// Placeholder values only so the module can load; nothing calls Supabase while `missingConfig` is true.
const SUPABASE_URL = url || 'https://missing-config.invalid'
const SUPABASE_KEY = key || 'missing-config'

/* ---------- "Remember me" ----------
 * Ticked   → session kept in localStorage (stays signed in after the browser is closed).
 * Unticked → session kept in sessionStorage (signed out when the browser is closed).
 * Passwords are never stored by the app — the browser's password manager handles that.
 */
const REMEMBER_KEY = 'eizi-admin-remember'
const EMAIL_KEY = 'eizi-admin-email'

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}

export const rememberPrefs = {
  get: () => safe(() => localStorage.getItem(REMEMBER_KEY) === '1', false),
  email: () => safe(() => localStorage.getItem(EMAIL_KEY) ?? '', ''),
  set(remember: boolean, email: string) {
    safe(() => {
      if (remember) {
        localStorage.setItem(REMEMBER_KEY, '1')
        localStorage.setItem(EMAIL_KEY, email)
      } else {
        localStorage.removeItem(REMEMBER_KEY)
        localStorage.removeItem(EMAIL_KEY)
      }
    }, undefined)
  },
}

const sessionStore = {
  getItem: (k: string) => safe(() => localStorage.getItem(k) ?? sessionStorage.getItem(k), null),
  setItem: (k: string, v: string) =>
    safe(() => {
      if (rememberPrefs.get()) {
        localStorage.setItem(k, v)
        sessionStorage.removeItem(k)
      } else {
        sessionStorage.setItem(k, v)
        localStorage.removeItem(k)
      }
    }, undefined),
  removeItem: (k: string) =>
    safe(() => {
      localStorage.removeItem(k)
      sessionStorage.removeItem(k)
    }, undefined),
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storageKey: 'eizi-admin-auth', storage: sessionStore, persistSession: !missingConfig, autoRefreshToken: !missingConfig },
})

/**
 * A throw-away client used only to create accounts from the admin portal.
 * It never stores a session, so signing a new user up does not log the admin out.
 */
export function signupClient() {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'eizi-admin-signup' },
  })
}
