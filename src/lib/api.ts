import { supabase } from './supabase'
import type {
  Category,
  ExerciseEntry,
  FoodEntry,
  ParsedFood,
  Profile,
  Supplement,
  SupplementLog,
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

// ---------- AI food parsing (Edge Function) ----------
export async function parseFood(text: string, categories: string[]): Promise<ParsedFood[]> {
  const { data, error } = await client().functions.invoke('parse-food', {
    body: { text, categories },
  })
  if (error) {
    // Edge Function errors carry the JSON body in error.context when available.
    let message = error.message
    try {
      const ctx = (error as { context?: Response }).context
      if (ctx && typeof ctx.json === 'function') {
        const body = await ctx.json()
        if (body?.error) message = body.error
      }
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }
  return (data?.items ?? []) as ParsedFood[]
}
