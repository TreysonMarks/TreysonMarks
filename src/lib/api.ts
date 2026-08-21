import { supabase } from './supabase'
import type {
  BodyMeasurement,
  Category,
  ExerciseEntry,
  FoodEntry,
  ParsedFood,
  ParsedPlanDay,
  ParsedWorkout,
  PlanDay,
  PlannedWorkout,
  Profile,
  Supplement,
  SupplementLog,
  WeightLog,
  Workout,
  WorkoutExercise,
  WorkoutWithExercises,
} from './types'

function client() {
  if (!supabase) throw new Error('Supabase not configured')
  return supabase
}

// ---------- profile ----------
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await client()
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data as Profile | null
}

export async function upsertProfile(profile: Profile): Promise<Profile> {
  const { data, error } = await client()
    .from('profiles')
    .upsert({ ...profile, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error
  return data as Profile
}

// ---------- food ----------
export async function fetchFood(userId: string, date: string): Promise<FoodEntry[]> {
  const { data, error } = await client()
    .from('food_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as FoodEntry[]
}

export async function addFood(entry: Omit<FoodEntry, 'id' | 'created_at'>): Promise<FoodEntry> {
  const { data, error } = await client().from('food_entries').insert(entry).select().single()
  if (error) throw error
  return data as FoodEntry
}

export async function deleteFood(id: string): Promise<void> {
  const { error } = await client().from('food_entries').delete().eq('id', id)
  if (error) throw error
}

// ---------- exercise ----------
export async function fetchExercise(userId: string, date: string): Promise<ExerciseEntry[]> {
  const { data, error } = await client()
    .from('exercise_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as ExerciseEntry[]
}

export async function addExercise(
  entry: Omit<ExerciseEntry, 'id' | 'created_at'>,
): Promise<ExerciseEntry> {
  const { data, error } = await client().from('exercise_entries').insert(entry).select().single()
  if (error) throw error
  return data as ExerciseEntry
}

export async function deleteExercise(id: string): Promise<void> {
  const { error } = await client().from('exercise_entries').delete().eq('id', id)
  if (error) throw error
}

// ---------- weight ----------
export async function fetchWeightRange(
  userId: string,
  fromDate: string,
): Promise<WeightLog[]> {
  const { data, error } = await client()
    .from('weight_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('date', fromDate)
    .order('date', { ascending: true })
  if (error) throw error
  return (data ?? []) as WeightLog[]
}

export async function upsertWeight(entry: Omit<WeightLog, 'id' | 'created_at'>): Promise<void> {
  const { error } = await client()
    .from('weight_logs')
    .upsert(entry, { onConflict: 'user_id,date' })
  if (error) throw error
}

// ---------- trends (range fetch) ----------
export async function fetchFoodRange(userId: string, fromDate: string): Promise<FoodEntry[]> {
  const { data, error } = await client()
    .from('food_entries')
    .select('*')
    .eq('user_id', userId)
    .gte('date', fromDate)
  if (error) throw error
  return (data ?? []) as FoodEntry[]
}

export async function fetchExerciseRange(
  userId: string,
  fromDate: string,
): Promise<ExerciseEntry[]> {
  const { data, error } = await client()
    .from('exercise_entries')
    .select('*')
    .eq('user_id', userId)
    .gte('date', fromDate)
  if (error) throw error
  return (data ?? []) as ExerciseEntry[]
}

// ---------- categories ----------
export const DEFAULT_CATEGORIES = [
  'Protein',
  'Carbs',
  'Dairy',
  'Produce',
  'Fats & oils',
  'Snacks',
  'Sweets',
  'Drinks',
  'Alcohol',
  'Other',
]

export async function fetchCategories(userId: string): Promise<Category[]> {
  const { data, error } = await client()
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('sort', { ascending: true })
  if (error) throw error
  return (data ?? []) as Category[]
}

/** Seed the default categories the first time a user has none. */
export async function seedCategories(userId: string): Promise<Category[]> {
  const rows = DEFAULT_CATEGORIES.map((name, i) => ({
    user_id: userId,
    name,
    sort: i,
  }))
  const { data, error } = await client().from('categories').insert(rows).select()
  if (error) throw error
  return (data ?? []) as Category[]
}

export async function addCategory(userId: string, name: string, sort: number): Promise<Category> {
  const { data, error } = await client()
    .from('categories')
    .insert({ user_id: userId, name, sort })
    .select()
    .single()
  if (error) throw error
  return data as Category
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await client().from('categories').delete().eq('id', id)
  if (error) throw error
}

// ---------- supplements ----------
export async function fetchSupplements(userId: string): Promise<Supplement[]> {
  const { data, error } = await client()
    .from('supplements')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Supplement[]
}

export async function addSupplement(
  entry: Omit<Supplement, 'id' | 'created_at'>,
): Promise<Supplement> {
  const { data, error } = await client().from('supplements').insert(entry).select().single()
  if (error) throw error
  return data as Supplement
}

export async function updateSupplement(
  id: string,
  patch: Partial<Supplement>,
): Promise<void> {
  const { error } = await client().from('supplements').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteSupplement(id: string): Promise<void> {
  const { error } = await client().from('supplements').delete().eq('id', id)
  if (error) throw error
}

export async function fetchSupplementLogs(userId: string): Promise<SupplementLog[]> {
  const { data, error } = await client()
    .from('supplement_logs')
    .select('*')
    .eq('user_id', userId)
    .order('taken_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as SupplementLog[]
}

export async function logSupplement(
  entry: Omit<SupplementLog, 'id' | 'created_at'>,
): Promise<SupplementLog> {
  const { data, error } = await client().from('supplement_logs').insert(entry).select().single()
  if (error) throw error
  return data as SupplementLog
}

export async function deleteSupplementLog(id: string): Promise<void> {
  const { error } = await client().from('supplement_logs').delete().eq('id', id)
  if (error) throw error
}

// ---------- workouts ----------
export async function fetchWorkouts(userId: string): Promise<WorkoutWithExercises[]> {
  const { data, error } = await client()
    .from('workouts')
    .select('*, workout_exercises(*)')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((w: Record<string, unknown>) => ({
    ...(w as unknown as Workout),
    exercises: ((w.workout_exercises ?? []) as WorkoutExercise[]).sort((a, b) => a.sort - b.sort),
  })) as WorkoutWithExercises[]
}

export async function fetchWorkoutsByDate(userId: string, date: string): Promise<Workout[]> {
  const { data, error } = await client()
    .from('workouts')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Workout[]
}

/** Workouts (no exercises) from a start date, for trend burn totals. */
export async function fetchWorkoutsRange(userId: string, fromDate: string): Promise<Workout[]> {
  const { data, error } = await client()
    .from('workouts')
    .select('id, user_id, date, title, type, notes, calories_burned, duration_min, rpe')
    .eq('user_id', userId)
    .gte('date', fromDate)
  if (error) throw error
  return (data ?? []) as Workout[]
}

export interface NewWorkout {
  date: string
  title: string
  type: Workout['type']
  notes: string | null
  calories_burned: number
  duration_min: number | null
  rpe: number | null
  exercises: Omit<WorkoutExercise, 'id' | 'workout_id' | 'user_id' | 'created_at' | 'sort'>[]
}

export async function createWorkout(userId: string, w: NewWorkout): Promise<WorkoutWithExercises> {
  const { data: workout, error } = await client()
    .from('workouts')
    .insert({
      user_id: userId,
      date: w.date,
      title: w.title,
      type: w.type,
      notes: w.notes,
      calories_burned: w.calories_burned,
      duration_min: w.duration_min,
      rpe: w.rpe,
    })
    .select()
    .single()
  if (error) throw error

  const rows = w.exercises.map((ex, i) => ({
    workout_id: (workout as Workout).id,
    user_id: userId,
    name: ex.name,
    sets: ex.sets,
    distance_m: ex.distance_m,
    duration_sec: ex.duration_sec,
    score: ex.score,
    sort: i,
  }))

  let exercises: WorkoutExercise[] = []
  if (rows.length) {
    const { data: exData, error: exErr } = await client()
      .from('workout_exercises')
      .insert(rows)
      .select()
    if (exErr) throw exErr
    exercises = (exData ?? []) as WorkoutExercise[]
  }
  return { ...(workout as Workout), exercises }
}

export async function deleteWorkout(id: string): Promise<void> {
  const { error } = await client().from('workouts').delete().eq('id', id)
  if (error) throw error
}

// ---------- body measurements ----------
export async function fetchBodyMeasurements(
  userId: string,
  fromDate?: string,
): Promise<BodyMeasurement[]> {
  let q = client().from('body_measurements').select('*').eq('user_id', userId)
  if (fromDate) q = q.gte('date', fromDate)
  const { data, error } = await q.order('date', { ascending: true })
  if (error) throw error
  return (data ?? []) as BodyMeasurement[]
}

export async function addBodyMeasurement(
  entry: Omit<BodyMeasurement, 'id' | 'created_at'>,
): Promise<BodyMeasurement> {
  const { data, error } = await client()
    .from('body_measurements')
    .insert(entry)
    .select()
    .single()
  if (error) throw error
  return data as BodyMeasurement
}

export async function deleteBodyMeasurement(id: string): Promise<void> {
  const { error } = await client().from('body_measurements').delete().eq('id', id)
  if (error) throw error
}

// ---------- bulk food import (CSV) ----------
export async function importFood(
  entries: Omit<FoodEntry, 'id' | 'created_at'>[],
): Promise<number> {
  if (entries.length === 0) return 0
  const { error } = await client().from('food_entries').insert(entries)
  if (error) throw error
  return entries.length
}

// ---------- plan: weekly template ----------
export async function fetchPlanDays(userId: string): Promise<PlanDay[]> {
  const { data, error } = await client()
    .from('plan_days')
    .select('*')
    .eq('user_id', userId)
    .order('weekday', { ascending: true })
  if (error) throw error
  return (data ?? []) as PlanDay[]
}

export async function upsertPlanDay(
  userId: string,
  day: Omit<PlanDay, 'id' | 'user_id' | 'created_at'>,
): Promise<PlanDay> {
  const { data, error } = await client()
    .from('plan_days')
    .upsert({ ...day, user_id: userId }, { onConflict: 'user_id,weekday' })
    .select()
    .single()
  if (error) throw error
  return data as PlanDay
}

export async function deletePlanDay(id: string): Promise<void> {
  const { error } = await client().from('plan_days').delete().eq('id', id)
  if (error) throw error
}

/** Replace the whole weekly template (used when applying an AI-generated plan). */
export async function replacePlanTemplate(
  userId: string,
  days: ParsedPlanDay[],
): Promise<PlanDay[]> {
  await client().from('plan_days').delete().eq('user_id', userId)
  const rows = days.map((d) => ({
    user_id: userId,
    weekday: d.weekday,
    title: d.title,
    type: d.type,
    is_rest: d.is_rest,
    notes: d.notes,
    prescription: d.prescription,
  }))
  const { data, error } = await client().from('plan_days').insert(rows).select()
  if (error) throw error
  return (data ?? []) as PlanDay[]
}

// ---------- plan: one-off planned sessions ----------
export async function fetchPlannedRange(
  userId: string,
  fromDate: string,
  toDate: string,
): Promise<PlannedWorkout[]> {
  const { data, error } = await client()
    .from('planned_workouts')
    .select('*')
    .eq('user_id', userId)
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date', { ascending: true })
  if (error) throw error
  return (data ?? []) as PlannedWorkout[]
}

export async function addPlannedWorkout(
  entry: Omit<PlannedWorkout, 'id' | 'created_at'>,
): Promise<PlannedWorkout> {
  const { data, error } = await client()
    .from('planned_workouts')
    .insert(entry)
    .select()
    .single()
  if (error) throw error
  return data as PlannedWorkout
}

export async function deletePlannedWorkout(id: string): Promise<void> {
  const { error } = await client().from('planned_workouts').delete().eq('id', id)
  if (error) throw error
}

// ---------- AI parsing (Edge Functions) ----------
async function invokeFn<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await client().functions.invoke(name, { body })
  if (error) {
    // Edge Function errors carry the JSON body in error.context when available.
    let message = error.message
    try {
      const ctx = (error as { context?: Response }).context
      if (ctx && typeof ctx.json === 'function') {
        const parsed = await ctx.json()
        if (parsed?.error) message = parsed.error
      }
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }
  return data as T
}

export async function parseFood(text: string, categories: string[]): Promise<ParsedFood[]> {
  const data = await invokeFn<{ items?: ParsedFood[] }>('parse-food', { text, categories })
  return data?.items ?? []
}

export async function parseWorkout(text: string): Promise<ParsedWorkout> {
  return invokeFn<ParsedWorkout>('parse-workout', { text })
}

export interface GeneratePlanInput {
  goal: string
  days_per_week: number
  equipment: string
  notes: string
}

export async function generatePlan(input: GeneratePlanInput): Promise<ParsedPlanDay[]> {
  const data = await invokeFn<{ days?: ParsedPlanDay[] }>('generate-plan', {
    goal: input.goal,
    days_per_week: input.days_per_week,
    equipment: input.equipment,
    notes: input.notes,
  })
  return data?.days ?? []
}
