import { useState } from 'react'
import { useSupplements, type SupplementView } from '../hooks/useSupplements'
import { prettyDay, isoDay } from '../lib/date'
import { format } from 'date-fns'
import Spinner from '../components/Spinner'

export default function Supplements() {
  const { views, loading, create, remove, take } = useSupplements()
  const [adding, setAdding] = useState(false)

  const sorted = [...views].sort((a, b) => statusRank(a) - statusRank(b))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Supplements</h1>
        <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setAdding((s) => !s)}>
          {adding ? 'Close' : '+ New'}
        </button>
      </div>

      {adding && (
        <AddSupplement
          onCreate={async (v) => {
            await create(v)
            setAdding(false)
          }}
        />
      )}

      {loading ? (
        <Spinner full />
      ) : sorted.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-slate-500">
          No supplements yet. Add creatine, vitamins, a weekly shot — anything you want to stay on
          top of.
        </p>
      ) : (
        <div className="space-y-3">
          {sorted.map((v) => (
            <SupplementCard
              key={v.supplement.id}
              view={v}
              onTake={() => take(v.supplement)}
              onDelete={() => remove(v.supplement.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function statusRank(v: SupplementView): number {
  return { overdue: 0, due: 1, upcoming: 2, as_needed: 3 }[v.status]
}

const STATUS = {
  overdue: { label: 'Overdue', color: 'text-bad', dot: '#f87171' },
  due: { label: 'Due now', color: 'text-warn', dot: '#fbbf24' },
  upcoming: { label: 'On track', color: 'text-good', dot: '#34d399' },
  as_needed: { label: 'As needed', color: 'text-slate-400', dot: '#64748b' },
}

function SupplementCard({
  view,
  onTake,
  onDelete,
}: {
  view: SupplementView
  onTake: () => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const { supplement: s, status, nextDue, lastTaken, daysUntilDue } = view
  const meta = STATUS[status]

  const dueText =
    status === 'as_needed'
      ? 'No schedule'
      : status === 'overdue'
        ? `Was due ${nextDue ? prettyDay(isoDay(nextDue)) : ''}`
        : status === 'due'
          ? 'Due today'
          : `Next in ${daysUntilDue}d · ${nextDue ? format(nextDue, 'MMM d') : ''}`

  return (
    <div className="card space-y-3">
      <div className="flex items-start gap-3">
        <span className="mt-1.5 h-2.5 w-2.5 flex-none rounded-full" style={{ background: meta.dot }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-100">{s.name}</span>
            {s.dose != null && (
              <span className="text-xs text-slate-400">
                {s.dose}
                {s.dose_unit ? ` ${s.dose_unit}` : ''}
              </span>
            )}
          </div>
          <div className={`text-xs ${meta.color}`}>
            {meta.label} · {dueText}
          </div>
          <div className="text-xs text-slate-500">
            {lastTaken ? `Last taken ${prettyDay(isoDay(new Date(lastTaken)))}` : 'Never taken'}
            {s.cadence_days ? ` · every ${cadenceLabel(s.cadence_days)}` : ''}
          </div>
          {s.notes && <div className="mt-1 text-xs text-slate-500">{s.notes}</div>}
        </div>
        <button
          onClick={onDelete}
          aria-label="Delete supplement"
          className="rounded-lg p-1 text-slate-600 hover:text-bad"
        >
          ✕
        </button>
      </div>
      <button
        className="btn-primary w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            await onTake()
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? 'Logging…' : 'Log dose now'}
      </button>
    </div>
  )
}

function cadenceLabel(days: number): string {
  if (days === 1) return 'day'
  if (days === 7) return 'week'
  if (days === 14) return '2 weeks'
  if (days === 30) return 'month'
  return `${days} days`
}

const CADENCE_OPTIONS = [
  { label: 'Daily', value: 1 },
  { label: 'Weekly', value: 7 },
  { label: 'Every 2 weeks', value: 14 },
  { label: 'Monthly', value: 30 },
  { label: 'As needed', value: 0 },
]

function AddSupplement({
  onCreate,
}: {
  onCreate: (v: {
    name: string
    dose: number | null
    dose_unit: string | null
    cadence_days: number | null
    notes: string | null
    active: boolean
  }) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [dose, setDose] = useState('')
  const [unit, setUnit] = useState('mg')
  const [cadence, setCadence] = useState(7)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    try {
      await onCreate({
        name: name.trim(),
        dose: dose ? Number(dose) : null,
        dose_unit: unit.trim() || null,
        cadence_days: cadence > 0 ? cadence : null,
        notes: notes.trim() || null,
        active: true,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <input
        autoFocus
        className="input"
        placeholder="e.g. Testosterone, Creatine, Vitamin D"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Dose</label>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            placeholder="optional"
            value={dose}
            onChange={(e) => setDose(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Unit</label>
          <input
            className="input"
            placeholder="mg, IU, mL, g"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="label">Cadence</label>
        <select
          className="input"
          value={cadence}
          onChange={(e) => setCadence(Number(e.target.value))}
        >
          {CADENCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <input
        className="input"
        placeholder="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <button type="submit" className="btn-primary w-full" disabled={busy || !name.trim()}>
        {busy ? 'Saving…' : 'Add supplement'}
      </button>
    </form>
  )
}
