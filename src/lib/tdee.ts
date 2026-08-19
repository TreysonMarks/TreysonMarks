import type { ActivityLevel, GoalType, Profile, Sex } from './types'

/** Activity multipliers for non-exercise lifestyle (exercise is logged separately). */
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary — desk job, little movement',
  light: 'Light — light activity / walking',
  moderate: 'Moderate — on your feet often',
  active: 'Active — physically demanding day',
  very_active: 'Very active — hard labor / athlete',
}

/** Daily calorie delta added to TDEE to produce the intake target. */
export const GOAL_DELTAS: Record<GoalType, number> = {
  aggressive_cut: -750,
  cut: -500,
  maintain: 0,
  bulk: 300,
}

export const GOAL_LABELS: Record<GoalType, string> = {
  aggressive_cut: 'Aggressive cut (−750/day)',
  cut: 'Cut (−500/day)',
  maintain: 'Maintain',
  bulk: 'Lean bulk (+300/day)',
}

export function ageFromBirthdate(birthdate: string, on = new Date()): number {
  const b = new Date(birthdate)
  let age = on.getFullYear() - b.getFullYear()
  const m = on.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && on.getDate() < b.getDate())) age--
  return age
}

/** Mifflin–St Jeor basal metabolic rate (kcal/day). */
export function bmr(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex === 'male' ? base + 5 : base - 161
}

/** Total daily energy expenditure from baseline lifestyle (excludes logged exercise). */
export function baselineBurn(profile: Profile, on = new Date()): number {
  const age = ageFromBirthdate(profile.birthdate, on)
  const rest = bmr(profile.sex, profile.weight_kg, profile.height_cm, age)
  return Math.round(rest * ACTIVITY_MULTIPLIERS[profile.activity_level])
}

/** The intake target for the day = baseline burn + goal delta. */
export function intakeTarget(profile: Profile, on = new Date()): number {
  return Math.round(baselineBurn(profile, on) + GOAL_DELTAS[profile.goal_type])
}
