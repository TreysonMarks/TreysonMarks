import { useState } from 'react'

interface Props {
  onAdd: (name: string, caloriesBurned: number, minutes: number | null) => Promise<void>
}

/** Compact adder for exercise entries. */
export default function QuickAdd({ onAdd }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [calories, setCalories] = useState('')
  const [minutes, setMinutes] = useState('')
  const [busy, setBusy] = useState(false)

  function reset() {
    setName('')
    setCalories('')
    setMinutes('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const cal = Number(calories)
    if (!name.trim() || !Number.isFinite(cal)) return
    setBusy(true)
    try {
      await onAdd(name.trim(), cal, minutes ? Number(minutes) : null)
      reset()
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button className="btn-ghost w-full border-dashed text-slate-300" onClick={() => setOpen(true)}>
        + Add exercise
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <input
        autoFocus
        className="input"
        placeholder="e.g. Morning run"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Calories burned</label>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            placeholder="kcal"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Minutes</label>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            placeholder="optional"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1" disabled={busy}>
          {busy ? 'Saving…' : 'Add'}
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            reset()
            setOpen(false)
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
