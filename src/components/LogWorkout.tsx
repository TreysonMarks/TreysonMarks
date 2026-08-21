import { useState } from 'react'
import type { NewWorkout } from '../lib/api'
import { parseWorkout } from '../lib/api'
import type { ParsedExercise, WorkoutType } from '../lib/types'
import { isoDay } from '../lib/date'

// Conservative MET values per workout type, for a rough burn estimate.
const MET_BY_TYPE: Record<WorkoutType, number> = {
  strength: 4.5,
  conditioning: 9,
  cardio: 8,
  mixed: 6,
}

/** kcal ≈ MET × bodyweight(kg) × hours. Kept conservative on purpose. */
function estimateBurn(type: WorkoutType, durationMin: number, bodyweightKg: number): number {
  if (!durationMin || !bodyweightKg) return 0
  return Math.round(MET_BY_TYPE[type] * bodyweightKg * (durationMin / 60))
}

interface DraftExercise extends ParsedExercise {}

interface Draft {
  date: string
  title: string
  type: WorkoutType
  duration_min: number | null
  calories_burned: number
  notes: string | null
  exercises: DraftExercise[]
}

const TYPES: WorkoutType[] = ['strength', 'conditioning', 'cardio', 'mixed']

function emptyDraft(): Draft {
  return {
    date: isoDay(),
    title: '',
    type: 'mixed',
    duration_min: null,
    calories_burned: 0,
    notes: null,
    exercises: [],
  }
}

function emptyExercise(): DraftExercise {
  return { name: '', sets: [], distance_m: null, duration_sec: null, score: null }
}

interface Props {
  aiAvailable: boolean
  bodyweightKg?: number
  onSave: (w: NewWorkout) => Promise<void>
  onClose: () => void
  /** Pre-seed the editor (e.g. "Log this" from a planned session). */
  initial?: {
    title: string
    type: WorkoutType
    date?: string
    exercises: ParsedExercise[]
  }
}

export default function LogWorkout({ aiAvailable, bodyweightKg, onSave, onClose, initial }: Props) {
  const seeded: Draft | null = initial
    ? { ...emptyDraft(), title: initial.title, type: initial.type, date: initial.date ?? isoDay(), exercises: initial.exercises }
    : null
  const [mode, setMode] = useState<'ai' | 'manual'>(initial ? 'manual' : aiAvailable ? 'ai' : 'manual')
  const [draft, setDraft] = useState<Draft | null>(seeded ?? (aiAvailable ? null : emptyDraft()))

  // AI parse state
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function runParse() {
    if (!text.trim()) return
    setBusy(true)
    setError(null)
    try {
      const p = await parseWorkout(text.trim())
      setDraft({
        date: isoDay(),
        title: p.title,
        type: p.type,
        duration_min: p.duration_min,
        calories_burned: p.calories_burned,
        notes: p.notes,
        exercises: p.exercises,
      })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!draft || !draft.title.trim()) return
    setBusy(true)
    try {
      await onSave({
        date: draft.date,
        title: draft.title.trim(),
        type: draft.type,
        notes: draft.notes,
        calories_burned: draft.calories_burned,
        duration_min: draft.duration_min,
        rpe: null,
        exercises: draft.exercises
          .filter((e) => e.name.trim())
          .map((e) => ({
            name: e.name.trim(),
            sets: e.sets,
            distance_m: e.distance_m,
            duration_sec: e.duration_sec,
            score: e.score,
          })),
      })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  // AI entry step (no draft yet)
  if (mode === 'ai' && !draft) {
    return (
      <div className="card space-y-4">
        <ModeTabs mode={mode} setMode={setMode} aiAvailable={aiAvailable} onManual={() => setDraft(emptyDraft())} />
        <textarea
          autoFocus
          className="input min-h-[100px]"
          placeholder="e.g. 5x5 back squat at 225, then 3 rounds: 10 pushups, 15 air squats, 200m run"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {error && <p className="text-sm text-bad">{error}</p>}
        <button className="btn-primary w-full" onClick={runParse} disabled={busy || !text.trim()}>
          {busy ? 'Asking Claude…' : 'Parse with Claude'}
        </button>
        <button className="w-full text-center text-xs text-slate-500" onClick={onClose}>
          Cancel
        </button>
      </div>
    )
  }

  if (!draft) return null
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v })

  return (
    <div className="card space-y-4">
      <ModeTabs
        mode={mode}
        setMode={(m) => {
          setMode(m)
          if (m === 'ai') setDraft(null)
        }}
        aiAvailable={aiAvailable}
        onManual={() => setDraft(draft ?? emptyDraft())}
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Title</label>
          <input
            className="input"
            placeholder="e.g. Lower body + metcon"
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
          />
        </div>
        <div>
          <label className="label">Type</label>
          <select
            className="input"
            value={draft.type}
            onChange={(e) => set('type', e.target.value as WorkoutType)}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Date</label>
          <input
            type="date"
            className="input"
            value={draft.date}
            max={isoDay()}
            onChange={(e) => set('date', e.target.value)}
          />
        </div>
        <div>
          <label className="label">Duration (min)</label>
          <input
            type="number"
            className="input"
            value={draft.duration_min ?? ''}
            onChange={(e) => set('duration_min', e.target.value ? Number(e.target.value) : null)}
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="label">Calories burned</label>
            {bodyweightKg ? (
              <button
                type="button"
                className="mb-1.5 text-[11px] font-medium text-accent disabled:opacity-40"
                disabled={!draft.duration_min}
                title={draft.duration_min ? 'Estimate from type, duration & bodyweight' : 'Enter a duration first'}
                onClick={() =>
                  set(
                    'calories_burned',
                    estimateBurn(draft.type, draft.duration_min ?? 0, bodyweightKg),
                  )
                }
              >
                Estimate
              </button>
            ) : null}
          </div>
          <input
            type="number"
            className="input"
            value={draft.calories_burned}
            onChange={(e) => set('calories_burned', Number(e.target.value) || 0)}
          />
        </div>
      </div>

      {/* Exercises */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-300">Exercises</span>
          <button
            className="text-xs text-accent"
            onClick={() => set('exercises', [...draft.exercises, emptyExercise()])}
          >
            + Add exercise
          </button>
        </div>
        {draft.exercises.map((ex, i) => (
          <ExerciseEditor
            key={i}
            ex={ex}
            onChange={(next) =>
              set(
                'exercises',
                draft.exercises.map((x, j) => (j === i ? next : x)),
              )
            }
            onRemove={() =>
              set(
                'exercises',
                draft.exercises.filter((_, j) => j !== i),
              )
            }
          />
        ))}
        {draft.exercises.length === 0 && (
          <p className="text-xs text-slate-500">
            No exercises — that's fine for a pure cardio or class session.
          </p>
        )}
      </div>

      {error && <p className="text-sm text-bad">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary flex-1" onClick={save} disabled={busy || !draft.title.trim()}>
          {busy ? 'Saving…' : 'Save workout'}
        </button>
        <button className="btn-ghost" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function ModeTabs({
  mode,
  setMode,
  aiAvailable,
  onManual,
}: {
  mode: 'ai' | 'manual'
  setMode: (m: 'ai' | 'manual') => void
  aiAvailable: boolean
  onManual: () => void
}) {
  return (
    <div className="flex gap-1 rounded-xl border border-base-border p-1">
      <button
        type="button"
        disabled={!aiAvailable}
        onClick={() => setMode('ai')}
        className={`flex-1 rounded-lg py-2 text-sm font-medium transition disabled:opacity-30 ${
          mode === 'ai' ? 'bg-accent text-slate-950' : 'text-slate-400'
        }`}
      >
        ✨ Describe
      </button>
      <button
        type="button"
        onClick={() => {
          setMode('manual')
          onManual()
        }}
        className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
          mode === 'manual' ? 'bg-accent text-slate-950' : 'text-slate-400'
        }`}
      >
        Manual
      </button>
    </div>
  )
}

function ExerciseEditor({
  ex,
  onChange,
  onRemove,
}: {
  ex: DraftExercise
  onChange: (next: DraftExercise) => void
  onRemove: () => void
}) {
  return (
    <div className="space-y-2 rounded-xl border border-base-border bg-base-bg p-3">
      <div className="flex gap-2">
        <input
          className="input"
          placeholder="Movement (e.g. Back squat, Run)"
          value={ex.name}
          onChange={(e) => onChange({ ...ex, name: e.target.value })}
        />
        <button onClick={onRemove} className="rounded-lg px-2 text-slate-500 hover:text-bad">
          ✕
        </button>
      </div>

      {/* Sets */}
      {ex.sets.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="number"
            className="input px-2"
            placeholder="reps"
            value={s.reps || ''}
            onChange={(e) =>
              onChange({
                ...ex,
                sets: ex.sets.map((x, j) => (j === i ? { ...x, reps: Number(e.target.value) || 0 } : x)),
              })
            }
          />
          <span className="text-slate-500">×</span>
          <input
            type="number"
            className="input px-2"
            placeholder="weight"
            value={s.weight || ''}
            onChange={(e) =>
              onChange({
                ...ex,
                sets: ex.sets.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value) || 0 } : x)),
              })
            }
          />
          <button
            onClick={() => onChange({ ...ex, sets: ex.sets.filter((_, j) => j !== i) })}
            className="px-1 text-slate-600 hover:text-bad"
          >
            ✕
          </button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button
          className="text-xs text-accent"
          onClick={() => onChange({ ...ex, sets: [...ex.sets, { reps: 0, weight: 0 }] })}
        >
          + set
        </button>
      </div>

      {/* Cardio / conditioning result */}
      <input
        className="input text-sm"
        placeholder="Result / score (optional) — e.g. 5k in 24:30, 12 rounds"
        value={ex.score ?? ''}
        onChange={(e) => onChange({ ...ex, score: e.target.value || null })}
      />
    </div>
  )
}
