export type Sex = 'male' | 'female'

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active'

export type Units = 'metric' | 'imperial'

/** Daily calorie delta applied to TDEE to form the intake target. */
export type GoalType = 'aggressive_cut' | 'cut' | 'maintain' | 'bulk'

export interface Profile {
  user_id: string
  sex: Sex
  birthdate: string // ISO date, drives age
  height_cm: number
  weight_kg: number
  activity_level: ActivityLevel
  goal_type: GoalType
  units: Units
  updated_at?: string
}

export interface FoodEntry {
  id: string
  user_id: string
  date: string // ISO date (YYYY-MM-DD), local day
  name: string
  calories: number
  quantity: number
  created_at?: string
}

export interface ExerciseEntry {
  id: string
  user_id: string
  date: string
  name: string
  calories_burned: number
  minutes: number | null
  created_at?: string
}

export interface WeightLog {
  id: string
  user_id: string
  date: string
  weight_kg: number
  created_at?: string
}

export interface DayTotals {
  intake: number
  exercise: number
  baselineBurn: number
  totalOut: number
  net: number
  target: number
  remaining: number
}
