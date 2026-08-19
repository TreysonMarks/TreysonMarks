export default function SetupNeeded() {
  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-extrabold">CalTrack needs Supabase keys</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-300">
        Cloud sync is powered by Supabase. Create a free project, then add its URL and anon key so
        the app can connect.
      </p>
      <ol className="mt-5 space-y-3 text-sm text-slate-300">
        <li>
          <span className="font-semibold text-slate-100">1.</span> Create a project at{' '}
          <span className="text-accent">supabase.com</span>.
        </li>
        <li>
          <span className="font-semibold text-slate-100">2.</span> Run{' '}
          <code className="rounded bg-black/40 px-1.5 py-0.5">db/schema.sql</code> in the SQL editor.
        </li>
        <li>
          <span className="font-semibold text-slate-100">3.</span> Copy{' '}
          <code className="rounded bg-black/40 px-1.5 py-0.5">.env.example</code> to{' '}
          <code className="rounded bg-black/40 px-1.5 py-0.5">.env</code> and paste your{' '}
          <code className="rounded bg-black/40 px-1.5 py-0.5">Project URL</code> and{' '}
          <code className="rounded bg-black/40 px-1.5 py-0.5">anon key</code> (Settings → API).
        </li>
        <li>
          <span className="font-semibold text-slate-100">4.</span> Restart the dev server.
        </li>
      </ol>
      <p className="mt-6 text-xs text-slate-500">
        Full walkthrough is in <code>docs/SETUP.md</code>.
      </p>
    </div>
  )
}
