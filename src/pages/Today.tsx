import { useState } from 'react'
import { useProfile } from '../hooks/useProfile'
import { useDay } from '../hooks/useDay'
import { useCategories } from '../hooks/useCategories'
import { isoDay, prettyDay, shiftDay } from '../lib/date'
import ProgressRing from '../components/ProgressRing'
import Spinner from '../components/Spinner'
import QuickAdd from '../components/QuickAdd'
import AddFood from '../components/AddFood'
import EntryRow from '../components/EntryRow'
import MacroBar from '../components/MacroBar'

export default function Today() {
  const { profile, loading: profileLoading } = useProfile()
  const { names: categoryNames } = useCategories()
  const [date, setDate] = useState(isoDay())
  const {
    food,
    exercise,
    totals,
    loading,
    logFood,
    logFoods,
    logExercise,
    removeFood,
    removeExercise,
  } = useDay(date, profile)

  const isToday = date === isoDay()
  const overTarget = totals.remaining < 0
  const consumedFraction = totals.target > 0 ? totals.intake / (totals.target + totals.exercise) : 0
  const aiAvailable = Boolean(profile?.anthropic_key)

  return (
    <div className="space-y-5">
      {/* Date navigation */}
      <div className="flex items-center justify-between">
        <button className="btn-ghost px-3 py-1.5" onClick={() => setDate(shiftDay(date, -1))}>
          ‹
        </button>
        <h1 className="text-lg font-bold">{prettyDay(date)}</h1>
        <button
          className="btn-ghost px-3 py-1.5 disabled:opacity-30"
          onClick={() => setDate(shiftDay(date, 1))}
          disabled={isToday}
        >
          ›
        </button>
      </div>

      {loading || profileLoading ? (
        <Spinner full />
      ) : (
        <>
          {/* Hero ring */}
          <div className="card flex flex-col items-center gap-3 py-6">
            <ProgressRing
              fraction={consumedFraction}
              over={overTarget}
              label={`${Math.abs(totals.remaining)}`}
              sublabel={overTarget ? 'over budget' : 'kcal left'}
            />
            <div className="grid w-full grid-cols-3 gap-2 text-center">
              <Stat label="In" value={totals.intake} tone="text-good" />
              <Stat label="Out" value={totals.totalOut} tone="text-warn" />
              <Stat
                label="Net"
                value={totals.net}
                tone={totals.net > 0 ? 'text-bad' : 'text-good'}
                signed
              />
            </div>
            <MacroBar protein={totals.protein} carbs={totals.carbs} fat={totals.fat} />
            <p className="text-xs text-slate-500">
              Target {totals.target} + {totals.exercise} exercise · baseline burn{' '}
              {totals.baselineBurn}
            </p>
          </div>

          {/* Food */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Food · {totals.intake} kcal
            </h2>
            <AddFood
              categories={categoryNames}
              aiAvailable={aiAvailable}
              onAdd={logFood}
              onAddMany={logFoods}
            />
            <div className="space-y-2">
              {food.map((f) => (
                <EntryRow
                  key={f.id}
                  title={f.name}
                  subtitle={foodSubtitle(f.category, f.quantity, f.protein_g, f.carbs_g, f.fat_g)}
                  value={`${Math.round(f.calories * f.quantity)}`}
                  tone="text-good"
                  onDelete={() => removeFood(f.id)}
                />
              ))}
              {food.length === 0 && <Empty>No food logged yet.</Empty>}
            </div>
          </section>

          {/* Exercise */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Exercise · {totals.exercise} kcal
            </h2>
            <QuickAdd onAdd={logExercise} />
            <div className="space-y-2">
              {exercise.map((e) => (
                <EntryRow
                  key={e.id}
                  title={e.name}
                  subtitle={e.minutes ? `${e.minutes} min` : undefined}
                  value={`${Math.round(e.calories_burned)}`}
                  tone="text-warn"
                  onDelete={() => removeExercise(e.id)}
                />
              ))}
              {exercise.length === 0 && <Empty>No exercise logged yet.</Empty>}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function foodSubtitle(
  category: string,
  qty: number,
  p: number,
  c: number,
  f: number,
): string {
  const macro = p || c || f ? `${Math.round(p * qty)}p ${Math.round(c * qty)}c ${Math.round(f * qty)}f` : ''
  const q = qty !== 1 ? `×${qty}` : ''
  return [category, q, macro].filter(Boolean).join(' · ')
}

function Stat({
  label,
  value,
  tone,
  signed,
}: {
  label: string
  value: number
  tone: string
  signed?: boolean
}) {
  const text = signed && value > 0 ? `+${value}` : `${value}`
  return (
    <div>
      <div className={`text-xl font-bold tabular-nums ${tone}`}>{text}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-1 py-2 text-sm text-slate-500">{children}</p>
}
