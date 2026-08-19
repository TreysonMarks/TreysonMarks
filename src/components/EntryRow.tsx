import { useState } from 'react'

interface Props {
  title: string
  subtitle?: string
  value: string
  tone: string
  onDelete: () => Promise<void>
}

export default function EntryRow({ title, subtitle, value, tone, onDelete }: Props) {
  const [busy, setBusy] = useState(false)

  async function del() {
    setBusy(true)
    try {
      await onDelete()
    } catch {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-base-border bg-base-card px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-slate-100">{title}</div>
        {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
      </div>
      <div className={`text-sm font-semibold tabular-nums ${tone}`}>{value}</div>
      <button
        onClick={del}
        disabled={busy}
        aria-label="Delete entry"
        className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-bad disabled:opacity-40"
      >
        ✕
      </button>
    </div>
  )
}
