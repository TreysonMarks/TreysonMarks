import { supabase } from './supabase'
import type {
  ExerciseEntry,
  FoodEntry,
  Profile,
  WeightLog,
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
