import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useWorkouts } from '../hooks/useWorkouts'
import { useProfile } from '../hooks/useProfile'
import {
  bestEstimated1RM,
  liftHistory,
  liftNames,
  personalRecords,
  weeklyVolume,
} from '../lib/strength'
import { prettyDay, shortDay } from '../lib/date'
import type { WorkoutExercise, WorkoutWithExercises } from '../lib/types'
import Spinner from '../components/Spinner'
import LogWorkout from '../components/LogWorkout'

type Tab = 'history' | 'progress'

export default function Workouts() {
  const { workouts, loading, create, remove } = useWorkouts()
  const { profile } = useProfile()
  const [tab, setTab] = useState<Tab>('history')
  const [logging, setLogging] = useState(false)
  const aiAvailable = Boolean(profile?.anthropic_key)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Workouts</h1>
        <button className="btn-primary px-3 py-1.5 text-sm" onClick={() => setLogging((s) => !s)}>
          {logging ? 'Close' : '+ Log'}
        </button>
      </div>

      {logging && (
        <LogWorkout
          aiAvailable={aiAvailable}
          onSave={create}
          onClose={() => setLogging(false)}
        />
      )}

      <div className="flex gap-1 rounded-xl border border-base-border p-1">
        <TabBtn active={tab === 'history'} onClick={() => setTab('history')}>
          History
        </TabBtn>
        <TabBtn active={tab === 'progress'} onClick={() => setTab('progress')}>
          Progress
        </TabBtn>
      </div>

      {loading ? (
        <Spinner full />
      ) : tab === 'history' ? (
        <History workouts={workouts} onDelete={remove} />
      ) : (
        <Progress workouts={workouts} />
      )}
    </div>
  )
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
        active ? 'bg-accent text-slate-950' : 'text-slate-400'
      }`}
    >
      {children}
    </button>
  )
}

// ---------- History ----------
function History({
  workouts,
  onDelete,
}: {
  workouts: WorkoutWithExercises[]
  onDelete: (id: string) => Promise<void>
}) {
  if (workouts.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-sm text-slate-500">
        No workouts yet. Tap <b>+ Log</b> to record a session — describe it and let Claude
        structure it, or enter it by hand.
      </p>
    )
  }
  return (
    <div className="space-y-3">
      {workouts.map((w) => (
        <div key={w.id} className="card space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-semibold text-slate-100">{w.title}</div>
              <div className="text-xs text-slate-500">
                {prettyDay(w.date)} · {w.type}
                {w.duration_min ? ` · ${w.duration_min} min` : ''}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-warn">{Math.round(w.calories_burned)}</span>
              <button
                onClick={() => onDelete(w.id)}
                className="rounded-lg p-1 text-slate-600 hover:text-bad"
                aria-label="Delete workout"
              >
                ✕
              </button>
            </div>
          </div>
          {w.exercises.length > 0 && (
            <ul className="space-y-1 border-t border-base-border pt-2 text-sm">
              {w.exercises.map((ex) => (
                <li key={ex.id} className="flex justify-between gap-2 text-slate-300">
                  <span className="min-w-0 truncate">{ex.name}</span>
                  <span className="flex-none text-slate-400">{exerciseSummary(ex)}</span>
                </li>
              ))}
            </ul>
          )}
          {w.notes && <p className="text-xs text-slate-500">{w.notes}</p>}
        </div>
      ))}
    </div>
  )
}

function exerciseSummary(ex: WorkoutExercise): string {
  if (ex.sets?.length) {
    const reps = ex.sets.map((s) => s.reps).join('/')
    const topW = Math.max(...ex.sets.map((s) => s.weight))
    const e1rm = Math.round(bestEstimated1RM(ex.sets))
    return `${ex.sets.length}×(${reps}) @ ${topW} · 1RM ~${e1rm}`
  }
  if (ex.score) return ex.score
  if (ex.distance_m) return `${ex.distance_m} m`
  if (ex.duration_sec) return `${Math.round(ex.duration_sec / 60)} min`
  return ''
}

// ---------- Progress ----------
const axisTick = { fill: '#64748b', fontSize: 11 }

function Progress({ workouts }: { workouts: WorkoutWithExercises[] }) {
  const lifts = useMemo(() => liftNames(workouts), [workouts])
  const [lift, setLift] = useState<string>(lifts[0] ?? '')
  const selected = lift || lifts[0] || ''

  const history = useMemo(
    () => (selected ? liftHistory(workouts, selected) : []),
    [workouts, selected],
  )
  const volume = useMemo(() => weeklyVolume(workouts), [workouts])
  const prs = useMemo(() => personalRecords(workouts), [workouts])

  const liftData = history.map((p) => ({ ...p, label: shortDay(p.date) }))
  const volData = volume.map((v) => ({ ...v, label: shortDay(v.week) }))

  return (
    <div className="space-y-5">
      {/* Estimated 1RM per lift */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-300">Estimated 1RM</h2>
          {lifts.length > 0 && (
            <select
              className="input w-auto py-1.5 text-sm"
              value={selected}
              onChange={(e) => setLift(e.target.value)}
            >
              {lifts.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          )}
        </div>
        {liftData.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            Log a lift with sets (reps × weight) to see a strength trend.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={liftData} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="#1e2a44" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} interval="preserveStartEnd" />
              <YAxis tick={axisTick} width={44} domain={['dataMin - 10', 'dataMax + 10']} />
              <Tooltip content={<DarkTooltip />} />
              <Line
                type="monotone"
                dataKey="est1RM"
                name="Est 1RM"
                stroke="#38bdf8"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Weekly volume */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-slate-300">Weekly volume (tonnage)</h2>
        {volData.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No lifting volume logged yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={volData} margin={{ top: 8, right: 6, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="#1e2a44" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} interval="preserveStartEnd" />
              <YAxis tick={axisTick} width={52} />
              <Tooltip content={<DarkTooltip />} cursor={{ fill: '#ffffff08' }} />
              <Bar dataKey="volume" name="Volume" fill="#34d399" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* PRs */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-slate-300">Personal records</h2>
        {prs.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            PRs show up here as your estimated 1RMs climb.
          </p>
        ) : (
          <div className="space-y-2">
            {prs.slice(0, 12).map((pr, i) => (
              <div
                key={`${pr.name}-${pr.date}-${i}`}
                className="flex items-center justify-between text-sm"
              >
                <span className="flex items-center gap-2 text-slate-200">
                  <span>🏅</span>
                  {pr.name}
                </span>
                <span className="text-slate-400">
                  <span className="font-semibold text-accent">{pr.est1RM}</span> · {prettyDay(pr.date)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface TooltipEntry {
  name: string
  value: number
  color: string
}
function DarkTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-base-border bg-base-bg px-3 py-2 text-xs shadow-xl">
      <div className="mb-1 font-semibold text-slate-300">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 tabular-nums">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-400">{p.name}</span>
          <span className="ml-auto font-medium text-slate-100">{Math.round(p.value)}</span>
        </div>
      ))}
    </div>
  )
}
