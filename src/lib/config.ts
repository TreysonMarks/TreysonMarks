// Runtime Supabase config so the app is self-configuring and shareable:
// a user pastes their own Supabase URL + anon key in-app (stored locally),
// falling back to build-time env vars when present. This lets one deployed
// copy serve many people, each pointed at their own Supabase project.

export interface AppConfig {
  url: string
  anonKey: string
}

const STORAGE_KEY = 'caltrack.supabase'

function fromEnv(): AppConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  return url && anonKey ? { url, anonKey } : null
}

function fromStorage(): AppConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AppConfig
    return parsed.url && parsed.anonKey ? parsed : null
  } catch {
    return null
  }
}

/** Stored config wins over env, so an in-app override always takes effect. */
export function getConfig(): AppConfig | null {
  return fromStorage() ?? fromEnv()
}

export function saveConfig(config: AppConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export function clearConfig() {
  localStorage.removeItem(STORAGE_KEY)
}
