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
  anthropic_key?: string | null
  anthropic_model?: string
  updated_at?: string
}

export interface FoodEntry {
  id: string
  user_id: string
  date: string // ISO date (YYYY-MM-DD), local day
  name: string
  calories: number
  quantity: number
  protein_g: number
  carbs_g: number
  fat_g: number
  category: string
  created_at?: string
}

/** A parsed-but-not-yet-saved food item from the AI parser. */
export interface ParsedFood {
  name: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  category: string
  quantity: number
}

export interface Category {
  id: string
  user_id: string
  name: string
  sort: number
}

export interface Supplement {
  id: string
  user_id: string
  name: string
  dose: number | null
  dose_unit: string | null
  cadence_days: number | null // 1 daily, 7 weekly, null/0 as-needed
  notes: string | null
  active: boolean
  created_at?: string
}

export interface SupplementLog {
  id: string
  user_id: string
  supplement_id: string
  taken_at: string
  dose: number | null
  note: string | null
  created_at?: string
}

export type WorkoutType = 'strength' | 'conditioning' | 'cardio' | 'mixed'

export interface StrengthSet {
  reps: number
  weight: number
}

export interface WorkoutExercise {
  id: string
  workout_id: string
  user_id: string
  name: string
  sets: StrengthSet[]
  distance_m: number | null
  duration_sec: number | null
  score: string | null
  sort: number
  created_at?: string
}

export interface Workout {
  id: string
  user_id: string
  date: string
  title: string
  type: WorkoutType
  notes: string | null
  calories_burned: number
  duration_min: number | null
  rpe: number | null
  created_at?: string
}

/** A workout joined with its exercises (used in the Workouts tab). */
export interface WorkoutWithExercises extends Workout {
  exercises: WorkoutExercise[]
}

/** Shape returned by the parse-workout Edge Function, pre-save. */
export interface ParsedExercise {
  name: string
  sets: StrengthSet[]
  distance_m: number | null
  duration_sec: number | null
  score: string | null
}

export interface ParsedWorkout {
  title: string
  type: WorkoutType
  calories_burned: number
  duration_min: number | null
  notes: string | null
  exercises: ParsedExercise[]
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
  protein: number
  carbs: number
  fat: number
}
