import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { clearConfig } from '../lib/config'

type Mode = 'password' | 'magic'

export default function Login() {
  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function signInPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setBusy(false)
    if (error) setError(error.message)
  }

  async function sendLink(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <div className="text-5xl">🔥</div>
        <h1 className="mt-3 text-3xl font-extrabold">CalTrack</h1>
        <p className="mt-1 text-sm text-slate-400">Your personal calorie ledger.</p>
      </div>

      {sent ? (
        <div className="card text-center">
          <p className="text-sm text-slate-200">
            Check <span className="font-semibold text-accent">{email}</span> for a magic link to sign
            in.
          </p>
          <button className="btn-ghost mt-4 w-full" onClick={() => setSent(false)}>
            Back
          </button>
        </div>
      ) : mode === 'password' ? (
        <form onSubmit={signInPassword} className="card space-y-4">
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-bad">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <button
            type="button"
            className="w-full text-center text-xs text-accent"
            onClick={() => {
              setMode('magic')
              setError(null)
            }}
          >
            Email me a magic link instead
          </button>
          <p className="text-center text-xs text-slate-500">
            No password yet? Sign in with a magic link once, then set one in Profile.
          </p>
        </form>
      ) : (
        <form onSubmit={sendLink} className="card space-y-4">
          <div>
            <label className="label" htmlFor="email-magic">
              Email
            </label>
            <input
              id="email-magic"
              type="email"
              required
              autoComplete="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-bad">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Sending…' : 'Send magic link'}
          </button>
          <button
            type="button"
            className="w-full text-center text-xs text-accent"
            onClick={() => {
              setMode('password')
              setError(null)
            }}
          >
            Use email + password instead
          </button>
          <p className="text-center text-xs text-slate-500">
            On an installed phone app, prefer a password — magic links can open in a separate browser.
          </p>
        </form>
      )}

      <button
        className="mt-4 text-center text-xs text-slate-600 hover:text-slate-400"
        onClick={() => {
          clearConfig()
          window.location.reload()
        }}
      >
        Change Supabase project
      </button>
    </div>
  )
}
