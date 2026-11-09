import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY in admin/.env')
}

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

export const supabase = createClient(url, key, {
  auth: { storageKey: 'eizi-admin-auth', storage: sessionStore, persistSession: true, autoRefreshToken: true },
})

/**
 * A throw-away client used only to create accounts from the admin portal.
 * It never stores a session, so signing a new user up does not log the admin out.
 */
export function signupClient() {
  return createClient(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'eizi-admin-signup' },
  })
}
