const env = import.meta.env

/** Public site settings — all set through VITE_* env vars (see .env.example). */
export const config = {
  apkUrl: (env.VITE_APK_URL as string | undefined)?.trim() || '',
  phone: (env.VITE_CONTACT_PHONE as string | undefined)?.trim() || '',
  email: (env.VITE_CONTACT_EMAIL as string | undefined)?.trim() || '',
  whatsapp: (env.VITE_WHATSAPP as string | undefined)?.replace(/\D/g, '') || '',
}

/** "03003209005" → "0300 3209005" */
export function prettyPhone(p: string) {
  const d = p.replace(/\D/g, '')
  return d.length === 11 ? `${d.slice(0, 4)} ${d.slice(4)}` : p
}
