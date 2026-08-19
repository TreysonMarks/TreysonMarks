import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getConfig } from './config'

const config = getConfig()

/** True once the app has Supabase connection details (from storage or env). */
export const isConfigured = Boolean(config)

/**
 * Null until configured, so the UI can show the in-app setup flow instead of
 * crashing. After the user saves config we reload the page to rebuild this.
 */
export const supabase: SupabaseClient | null = config
  ? createClient(config.url, config.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null
