import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** True when the app has been given Supabase credentials. */
export const isConfigured = Boolean(url && anonKey)

/**
 * The client is null until configured, so the UI can show a setup screen
 * instead of crashing when the .env is missing.
 */
export const supabase: SupabaseClient | null = isConfigured
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null
