import { useState } from 'react'
import { saveConfig } from '../lib/config'

export default function Onboarding() {
  const [url, setUrl] = useState('')
  const [anonKey, setAnonKey] = useState('')
  const [showHelp, setShowHelp] = useState(false)

  function connect(e: React.FormEvent) {
    e.preventDefault()
    const cleanUrl = url.trim().replace(/\/+$/, '')
    if (!cleanUrl || !anonKey.trim()) return
    saveConfig({ url: cleanUrl, anonKey: anonKey.trim() })
    // Reload so the Supabase client is rebuilt with the new config.
    window.location.reload()
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-6 text-center">
        <div className="text-5xl">🔥</div>
        <h1 className="mt-3 text-2xl font-extrabold">Connect CalTrack</h1>
        <p className="mt-1 text-sm text-slate-400">
          Point the app at your own Supabase project. Your data stays in your
          account.
        </p>
      </div>

      <form onSubmit={connect} className="card space-y-4">
        <div>
          <label className="label">Supabase Project URL</label>
          <input
            className="input"
            placeholder="https://xxxx.supabase.co"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Supabase anon public key</label>
          <textarea
            className="input min-h-[80px] font-mono text-xs"
            placeholder="eyJhbGciOi..."
            value={anonKey}
            onChange={(e) => setAnonKey(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary w-full">
          Connect
        </button>
      </form>

      <button
        onClick={() => setShowHelp((s) => !s)}
        className="mt-4 text-center text-sm text-accent"
      >
        {showHelp ? 'Hide setup steps' : "First time? Show setup steps"}
      </button>

      {showHelp && (
        <div className="card mt-3 space-y-3 text-sm text-slate-300">
          <Step n={1}>
            Create a free project at <span className="text-accent">supabase.com</span>.
          </Step>
          <Step n={2}>
            In <b>SQL Editor</b>, paste and run the contents of{' '}
            <code className="rounded bg-black/40 px-1">db/schema.sql</code> from the repo.
          </Step>
          <Step n={3}>
            In <b>Project Settings → API</b>, copy the <b>Project URL</b> and{' '}
            <b>anon public</b> key into the fields above.
          </Step>
          <Step n={4}>
            Under <b>Authentication → URL Configuration</b>, add this app's URL to{' '}
            <b>Redirect URLs</b> so magic links come back here.
          </Step>
          <Step n={5}>
            (Optional, for AI food logging) deploy the Edge Function:{' '}
            <code className="rounded bg-black/40 px-1">
              supabase functions deploy parse-food
            </code>
            , then add your Anthropic key in Profile after signing in.
          </Step>
          <p className="text-xs text-slate-500">Full walkthrough: docs/SETUP.md</p>
        </div>
      )}
    </div>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">
        {n}
      </span>
      <span>{children}</span>
    </div>
  )
}
