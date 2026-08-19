import type { PlanExercise } from '../lib/types'

interface Props {
  value: PlanExercise[]
  onChange: (next: PlanExercise[]) => void
}

const EMPTY: PlanExercise = { name: '', sets: null, reps: null, weight: null, notes: null }

export default function PrescriptionEditor({ value, onChange }: Props) {
  const update = (i: number, patch: Partial<PlanExercise>) =>
    onChange(value.map((p, j) => (j === i ? { ...p, ...patch } : p)))

  return (
    <div className="space-y-2">
      {value.map((p, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-base-border bg-base-card p-2.5">
          <div className="flex gap-2">
            <input
              className="input px-2.5 py-2 text-sm"
              placeholder="Movement"
              value={p.name}
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <button
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="px-1 text-slate-600 hover:text-bad"
              aria-label="Remove movement"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input
              className="input px-2 py-1.5 text-sm"
              type="number"
              placeholder="sets"
              value={p.sets ?? ''}
              onChange={(e) => update(i, { sets: e.target.value ? Number(e.target.value) : null })}
            />
            <input
              className="input px-2 py-1.5 text-sm"
              placeholder="reps"
              value={p.reps ?? ''}
              onChange={(e) => update(i, { reps: e.target.value || null })}
            />
            <input
              className="input px-2 py-1.5 text-sm"
              type="number"
              placeholder="weight"
              value={p.weight ?? ''}
              onChange={(e) => update(i, { weight: e.target.value ? Number(e.target.value) : null })}
            />
          </div>
        </div>
      ))}
      <button
        className="text-xs text-accent"
        onClick={() => onChange([...value, { ...EMPTY }])}
      >
        + movement
      </button>
    </div>
  )
}
