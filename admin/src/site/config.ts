const env = import.meta.env

/** Latest Android build page (install / download + QR). VITE_APK_URL overrides it for a newer build. */
const DEFAULT_APK_URL = 'https://expo.dev/accounts/razasoftwareengs-team/projects/raza-software-eng/builds/03135011-3a1d-44e9-9c1a-7ea626e51787'

/** Public site settings — all set through VITE_* env vars (see .env.example). */
export const config = {
  apkUrl: (env.VITE_APK_URL as string | undefined)?.trim() || DEFAULT_APK_URL,
  phone: (env.VITE_CONTACT_PHONE as string | undefined)?.trim() || '',
  email: (env.VITE_CONTACT_EMAIL as string | undefined)?.trim() || '',
  whatsapp: (env.VITE_WHATSAPP as string | undefined)?.replace(/\D/g, '') || '',
}

/** "03003209005" → "0300 3209005" */
export function prettyPhone(p: string) {
  const d = p.replace(/\D/g, '')
  return d.length === 11 ? `${d.slice(0, 4)} ${d.slice(4)}` : p
}
