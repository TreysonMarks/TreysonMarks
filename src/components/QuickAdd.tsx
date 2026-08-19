import { useState } from 'react'

type FoodAdd = (name: string, calories: number, quantity: number) => Promise<void>
type ExerciseAdd = (name: string, calories: number, minutes: number | null) => Promise<void>

interface Props {
  kind: 'food' | 'exercise'
  onAdd: FoodAdd | ExerciseAdd
}

export default function QuickAdd({ kind, onAdd }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [calories, setCalories] = useState('')
  const [extra, setExtra] = useState('') // quantity for food, minutes for exercise
  const [busy, setBusy] = useState(false)

  const isFood = kind === 'food'

  function reset() {
    setName('')
    setCalories('')
    setExtra('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const cal = Number(calories)
    if (!name.trim() || !Number.isFinite(cal)) return
    setBusy(true)
    try {
      if (isFood) {
        const qty = extra ? Number(extra) : 1
        await (onAdd as FoodAdd)(name.trim(), cal, Number.isFinite(qty) && qty > 0 ? qty : 1)
      } else {
        const mins = extra ? Number(extra) : null
        await (onAdd as ExerciseAdd)(name.trim(), cal, mins)
      }
      reset()
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        className="btn-ghost w-full border-dashed text-slate-300"
        onClick={() => setOpen(true)}
      >
        + Add {isFood ? 'food' : 'exercise'}
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <input
        autoFocus
        className="input"
        placeholder={isFood ? 'e.g. Chicken burrito' : 'e.g. Morning run'}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">{isFood ? 'Calories' : 'Calories burned'}</label>
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
          <label className="label">{isFood ? 'Servings' : 'Minutes'}</label>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            placeholder={isFood ? '1' : 'optional'}
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
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
