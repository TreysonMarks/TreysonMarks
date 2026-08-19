import { useState } from 'react'
import { usePlan, weekStartOf, type PlanDayView } from '../hooks/usePlan'
import { generatePlan } from '../lib/api'
import { WEEKDAY_LONG, WEEKDAY_SHORT, prescriptionLine, prescriptionToExercises } from '../lib/plan'
import { isoDay, shiftDay, prettyDay } from '../lib/date'
import { parseISO, format } from 'date-fns'
import type { ParsedExercise, PlanExercise, WorkoutType } from '../lib/types'
import Spinner from './Spinner'
import PrescriptionEditor from './PrescriptionEditor'

const TYPES: WorkoutType[] = ['strength', 'conditioning', 'cardio', 'mixed']

interface Props {
  aiAvailable: boolean
  onLogFromPlan: (initial: {
    title: string
    type: WorkoutType
    date: string
    exercises: ParsedExercise[]
  }) => void
}

export default function PlanView({ aiAvailable, onLogFromPlan }: Props) {
  const [weekStart, setWeekStart] = useState(weekStartOf(isoDay()))
  const [selected, setSelected] = useState(isoDay())
  const plan = usePlan(weekStart)
  const [showTemplate, setShowTemplate] = useState(false)
  const [showGen, setShowGen] = useState(false)

  const weekEnd = shiftDay(weekStart, 6)
  const selectedDay = plan.days.find((d) => d.date === selected) ?? plan.days[0]

  function jump(delta: number) {
    const nextStart = shiftDay(weekStart, delta * 7)
    setWeekStart(nextStart)
    setSelected(nextStart) // select the first day of the shown week
  }

  return (
    <div className="space-y-5">
      {/* Week nav */}
      <div className="flex items-center justify-between">
        <button className="btn-ghost px-3 py-1.5" onClick={() => jump(-1)}>
          ‹
        </button>
        <div className="text-center">
          <div className="text-sm font-semibold">
            {format(parseISO(weekStart), 'MMM d')} – {format(parseISO(weekEnd), 'MMM d')}
          </div>
          <button
            className="text-xs text-accent"
            onClick={() => {
              setWeekStart(weekStartOf(isoDay()))
              setSelected(isoDay())
            }}
          >
            This week
          </button>
        </div>
        <button className="btn-ghost px-3 py-1.5" onClick={() => jump(1)}>
          ›
        </button>
      </div>

      {plan.loading ? (
        <Spinner full />
      ) : (
        <>
          {/* Day strip */}
          <div className="grid grid-cols-7 gap-1">
            {plan.days.map((d) => (
              <DayCell
                key={d.date}
                day={d}
                selected={d.date === selected}
                today={d.date === isoDay()}
                onClick={() => setSelected(d.date)}
              />
            ))}
          </div>

          {/* Selected day detail */}
          {selectedDay && (
            <DayDetail
              day={selectedDay}
              onLog={onLogFromPlan}
              onAddOneOff={plan.addOneOff}
              onRemoveOneOff={plan.removeOneOff}
            />
          )}

          {/* Weekly template */}
          <div className="card">
            <button
              className="flex w-full items-center justify-between text-sm font-semibold text-slate-300"
              onClick={() => setShowTemplate((s) => !s)}
            >
              <span>Weekly template</span>
              <span className="text-slate-500">{showTemplate ? '−' : '+'}</span>
            </button>
            {showTemplate && (
              <div className="mt-3 space-y-3">
                {Array.from({ length: 7 }, (_, wd) => (
                  <TemplateDayEditor
                    key={wd}
                    weekday={wd}
                    existing={plan.template.find((t) => t.weekday === wd) ?? null}
                    onSave={plan.saveTemplateDay}
                    onClear={plan.clearTemplateDay}
                  />
                ))}
              </div>
            )}
          </div>

          {/* AI generate */}
          {aiAvailable && (
            <div className="card">
              <button
                className="flex w-full items-center justify-between text-sm font-semibold text-slate-300"
                onClick={() => setShowGen((s) => !s)}
              >
                <span>✨ Generate a plan with Claude</span>
                <span className="text-slate-500">{showGen ? '−' : '+'}</span>
              </button>
              {showGen && <GeneratePlan onApply={plan.applyGeneratedPlan} />}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function DayCell({
  day,
  selected,
  today,
  onClick,
}: {
  day: PlanDayView
  selected: boolean
  today: boolean
  onClick: () => void
}) {
  const planned = day.oneOffs.length > 0 || (day.template && !day.template.is_rest)
  const rest =
    !planned &&
    ((day.template?.is_rest ?? false) || day.oneOffs.some((o) => o.is_rest))
  const done = day.loggedCount > 0

  const dot = done ? '#34d399' : planned ? '#38bdf8' : rest ? '#475569' : 'transparent'

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-xl border py-2 transition ${
        selected ? 'border-accent bg-accent/10' : 'border-base-border'
      }`}
    >
      <span className="text-[10px] uppercase text-slate-500">{WEEKDAY_SHORT[day.weekday]}</span>
      <span className={`text-sm font-semibold ${today ? 'text-accent' : 'text-slate-200'}`}>
        {format(parseISO(day.date), 'd')}
      </span>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
    </button>
  )
}

function DayDetail({
  day,
  onLog,
  onAddOneOff,
  onRemoveOneOff,
}: {
  day: PlanDayView
  onLog: Props['onLogFromPlan']
  onAddOneOff: ReturnType<typeof usePlan>['addOneOff']
  onRemoveOneOff: ReturnType<typeof usePlan>['removeOneOff']
}) {
  const [adding, setAdding] = useState(false)
  const sessions: {
    id: string | null
    title: string
    type: WorkoutType
    is_rest: boolean
    notes: string | null
    prescription: PlanExercise[]
  }[] = []

  if (day.template && (day.template.title || day.template.is_rest)) {
    sessions.push({
      id: null,
      title: day.template.title || 'Training',
      type: day.template.type,
      is_rest: day.template.is_rest,
      notes: day.template.notes,
      prescription: day.template.prescription ?? [],
    })
  }
  for (const o of day.oneOffs) {
    sessions.push({
      id: o.id,
      title: o.title || 'Session',
      type: o.type,
      is_rest: o.is_rest,
      notes: o.notes,
      prescription: o.prescription ?? [],
    })
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">{prettyDay(day.date)}</h2>
        {day.loggedCount > 0 && (
          <span className="text-xs font-semibold text-good">✓ {day.loggedCount} logged</span>
        )}
      </div>

      {sessions.length === 0 && (
        <p className="text-sm text-slate-500">Nothing planned. Add a session below.</p>
      )}

      {sessions.map((s, i) => (
        <div key={s.id ?? `tpl-${i}`} className="rounded-xl border border-base-border bg-base-bg p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-semibold text-slate-100">
                {s.is_rest ? '😴 Rest day' : s.title}
              </div>
              {!s.is_rest && <div className="text-xs text-slate-500">{s.type}</div>}
            </div>
            <div className="flex items-center gap-2">
              {s.id === null && <span className="text-[10px] text-slate-500">weekly</span>}
              {s.id && (
                <button
                  onClick={() => onRemoveOneOff(s.id!)}
                  className="text-slate-600 hover:text-bad"
                  aria-label="Remove session"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          {s.prescription.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-slate-300">
              {s.prescription.map((p, j) => (
                <li key={j} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate">{p.name}</span>
                  <span className="flex-none text-slate-400">{prescriptionLine(p)}</span>
                </li>
              ))}
            </ul>
          )}
          {s.notes && <p className="mt-1 text-xs text-slate-500">{s.notes}</p>}
          {!s.is_rest && (
            <button
              className="btn-primary mt-3 w-full py-2 text-sm"
              onClick={() =>
                onLog({
                  title: s.title,
                  type: s.type,
                  date: day.date,
                  exercises: prescriptionToExercises(s.prescription),
                })
              }
            >
              Log this session
            </button>
          )}
        </div>
      ))}

      {adding ? (
        <OneOffForm
          onCancel={() => setAdding(false)}
          onSave={async (v) => {
            await onAddOneOff({ ...v, date: day.date })
            setAdding(false)
          }}
        />
      ) : (
        <button className="btn-ghost w-full border-dashed text-sm" onClick={() => setAdding(true)}>
          + Add a one-off session
        </button>
      )}
    </div>
  )
}

function OneOffForm({
  onSave,
  onCancel,
}: {
  onSave: (v: {
    title: string
    type: WorkoutType
    is_rest: boolean
    notes: string | null
    prescription: PlanExercise[]
  }) => Promise<void>
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<WorkoutType>('mixed')
  const [prescription, setPrescription] = useState<PlanExercise[]>([])
  const [busy, setBusy] = useState(false)

  return (
    <div className="space-y-3 rounded-xl border border-base-border bg-base-bg p-3">
      <input
        autoFocus
        className="input"
        placeholder="Session title (or leave blank for rest)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <select className="input" value={type} onChange={(e) => setType(e.target.value as WorkoutType)}>
        {TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <PrescriptionEditor value={prescription} onChange={setPrescription} />
      <div className="flex gap-2">
        <button
          className="btn-primary flex-1"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await onSave({
                title: title.trim(),
                type,
                is_rest: !title.trim() && prescription.length === 0,
                notes: null,
                prescription,
              })
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'Saving…' : 'Add'}
        </button>
        <button className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function TemplateDayEditor({
  weekday,
  existing,
  onSave,
  onClear,
}: {
  weekday: number
  existing: import('../lib/types').PlanDay | null
  onSave: ReturnType<typeof usePlan>['saveTemplateDay']
  onClear: ReturnType<typeof usePlan>['clearTemplateDay']
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(existing?.title ?? '')
  const [type, setType] = useState<WorkoutType>(existing?.type ?? 'mixed')
  const [isRest, setIsRest] = useState(existing?.is_rest ?? false)
  const [prescription, setPrescription] = useState<PlanExercise[]>(existing?.prescription ?? [])
  const [busy, setBusy] = useState(false)

  const summary = existing
    ? existing.is_rest
      ? 'Rest'
      : existing.title || 'Training'
    : '—'

  return (
    <div className="rounded-xl border border-base-border">
      <button
        className="flex w-full items-center justify-between px-3 py-2.5 text-sm"
        onClick={() => setOpen((s) => !s)}
      >
        <span className="font-medium text-slate-200">{WEEKDAY_LONG[weekday]}</span>
        <span className="text-slate-500">{summary}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-base-border p-3">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={isRest}
              onChange={(e) => setIsRest(e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            Rest day
          </label>
          {!isRest && (
            <>
              <input
                className="input"
                placeholder="Title (e.g. Push, Legs, Conditioning)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <select
                className="input"
                value={type}
                onChange={(e) => setType(e.target.value as WorkoutType)}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <PrescriptionEditor value={prescription} onChange={setPrescription} />
            </>
          )}
          <div className="flex gap-2">
            <button
              className="btn-primary flex-1 py-2 text-sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await onSave({
                    weekday,
                    title: isRest ? 'Rest' : title.trim(),
                    type,
                    is_rest: isRest,
                    notes: null,
                    prescription: isRest ? [] : prescription,
                  })
                  setOpen(false)
                } finally {
                  setBusy(false)
                }
              }}
            >
              {busy ? 'Saving…' : 'Save day'}
            </button>
            {existing && (
              <button className="btn-ghost py-2 text-sm" onClick={() => onClear(existing.id)}>
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function GeneratePlan({
  onApply,
}: {
  onApply: ReturnType<typeof usePlan>['applyGeneratedPlan']
}) {
  const [goal, setGoal] = useState('General fitness')
  const [days, setDays] = useState(4)
  const [equipment, setEquipment] = useState('Full gym')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setBusy(true)
    setError(null)
    try {
      const generated = await generatePlan({
        goal,
        days_per_week: days,
        equipment,
        notes,
      })
      if (generated.length) {
        await onApply(generated)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 space-y-3">
      <p className="text-xs text-slate-500">
        Claude drafts a weekly template you can then edit. This replaces your current template.
      </p>
      <div>
        <label className="label">Goal</label>
        <input className="input" value={goal} onChange={(e) => setGoal(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Days / week</label>
          <select
            className="input"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Equipment</label>
          <input
            className="input"
            value={equipment}
            onChange={(e) => setEquipment(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="label">Anything else?</label>
        <input
          className="input"
          placeholder="e.g. bad knees, love kettlebells"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-bad">{error}</p>}
      <button className="btn-primary w-full" onClick={run} disabled={busy}>
        {busy ? 'Designing…' : 'Generate & apply'}
      </button>
    </div>
  )
}
