import type { ParsedExercise, PlanExercise } from './types'

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const WEEKDAY_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

/** First integer found in a reps string ("8-12" -> 8, "AMRAP" -> 0). */
function firstInt(s: string | null): number {
  if (!s) return 0
  const m = s.match(/\d+/)
  return m ? Number(m[0]) : 0
}

/** Turn a prescription into logger-ready exercises (sets expanded from targets). */
export function prescriptionToExercises(prescription: PlanExercise[]): ParsedExercise[] {
  return prescription.map((p) => {
    const setCount = p.sets && p.sets > 0 ? p.sets : 0
    const reps = firstInt(p.reps)
    const sets =
      setCount > 0
        ? Array.from({ length: setCount }, () => ({ reps, weight: p.weight ?? 0 }))
        : []
    return {
      name: p.name,
      sets,
      distance_m: null,
      duration_sec: null,
      score: setCount === 0 && p.reps ? p.reps : null,
    }
  })
}

/** One-line summary of a prescribed movement. */
export function prescriptionLine(p: PlanExercise): string {
  const parts: string[] = []
  if (p.sets && p.reps) parts.push(`${p.sets}×${p.reps}`)
  else if (p.sets) parts.push(`${p.sets} sets`)
  else if (p.reps) parts.push(p.reps)
  if (p.weight) parts.push(`@ ${p.weight}`)
  return parts.join(' ')
}
