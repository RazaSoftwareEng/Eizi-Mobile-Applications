/** Shown instead of a blank page when the build has no Supabase settings. */
export function SetupNeeded() {
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
        <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-xl font-black text-amber-700">!</div>
        <h1 className="text-xl font-bold text-ink">Admin portal isn’t configured</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This build has no Supabase settings. Add these environment variables to your hosting project (e.g. Vercel → Settings → Environment
          Variables), then <strong>redeploy</strong>:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs leading-6 text-slate-100">
          {'VITE_SUPABASE_URL=https://<project-ref>.supabase.co\nVITE_SUPABASE_PUBLISHABLE_KEY=<publishable or anon key>'}
        </pre>
        <p className="mt-3 text-xs text-slate-500">Use the public publishable/anon key only — never the service_role key.</p>
      </div>
    </div>
  )
}
