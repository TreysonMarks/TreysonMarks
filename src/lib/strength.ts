import type { StrengthSet, WorkoutWithExercises } from './types'

/** Epley estimated 1-rep max for a single set. */
export function epley1RM(set: StrengthSet): number {
  if (set.weight <= 0 || set.reps <= 0) return 0
  return set.weight * (1 + set.reps / 30)
}

/** Best estimated 1RM across a list of sets. */
export function bestEstimated1RM(sets: StrengthSet[]): number {
  return sets.reduce((max, s) => Math.max(max, epley1RM(s)), 0)
}

/** Total volume load (Σ reps × weight) across sets. */
export function setsVolume(sets: StrengthSet[]): number {
  return sets.reduce((sum, s) => sum + s.reps * s.weight, 0)
}

export interface LiftPoint {
  date: string
  est1RM: number
  topSet: number // heaviest weight lifted that day
  volume: number
}

/** Per-date best estimated 1RM + volume for one named lift, oldest first. */
export function liftHistory(workouts: WorkoutWithExercises[], name: string): LiftPoint[] {
  const byDate = new Map<string, LiftPoint>()
  for (const w of workouts) {
    for (const ex of w.exercises) {
      if (ex.name.toLowerCase() !== name.toLowerCase()) continue
      if (!ex.sets?.length) continue
      const est = Math.round(bestEstimated1RM(ex.sets))
      const top = Math.round(ex.sets.reduce((m, s) => Math.max(m, s.weight), 0))
      const vol = Math.round(setsVolume(ex.sets))
      const prev = byDate.get(w.date)
      if (!prev) {
        byDate.set(w.date, { date: w.date, est1RM: est, topSet: top, volume: vol })
      } else {
        prev.est1RM = Math.max(prev.est1RM, est)
        prev.topSet = Math.max(prev.topSet, top)
        prev.volume += vol
      }
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

/** All strength lift names seen, most-frequent first. */
export function liftNames(workouts: WorkoutWithExercises[]): string[] {
  const counts = new Map<string, number>()
  for (const w of workouts) {
    for (const ex of w.exercises) {
      if (!ex.sets?.length) continue
      counts.set(ex.name, (counts.get(ex.name) ?? 0) + 1)
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)
}

/** Weekly total tonnage (volume) across all lifts, oldest week first. */
export interface WeekVolume {
  week: string // ISO date of week start (Monday)
  volume: number
}

function mondayOf(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  const day = (d.getDay() + 6) % 7 // 0 = Monday
  d.setDate(d.getDate() - day)
  return d.toISOString().slice(0, 10)
}

export function weeklyVolume(workouts: WorkoutWithExercises[]): WeekVolume[] {
  const byWeek = new Map<string, number>()
  for (const w of workouts) {
    let vol = 0
    for (const ex of w.exercises) vol += setsVolume(ex.sets ?? [])
    if (vol <= 0) continue
    const wk = mondayOf(w.date)
    byWeek.set(wk, (byWeek.get(wk) ?? 0) + vol)
  }
  return [...byWeek.entries()]
    .map(([week, volume]) => ({ week, volume: Math.round(volume) }))
    .sort((a, b) => a.week.localeCompare(b.week))
}

/** Detect PRs: a workout's lift whose est 1RM beats every earlier session. */
export interface PR {
  date: string
  name: string
  est1RM: number
}

export function personalRecords(workouts: WorkoutWithExercises[]): PR[] {
  const chron = [...workouts].sort((a, b) => a.date.localeCompare(b.date))
  const best = new Map<string, number>()
  const prs: PR[] = []
  for (const w of chron) {
    for (const ex of w.exercises) {
      if (!ex.sets?.length) continue
      const est = Math.round(bestEstimated1RM(ex.sets))
      if (est <= 0) continue
      const key = ex.name.toLowerCase()
      if (est > (best.get(key) ?? 0)) {
        best.set(key, est)
        prs.push({ date: w.date, name: ex.name, est1RM: est })
      }
    }
  }
  return prs.reverse() // most recent first
}
