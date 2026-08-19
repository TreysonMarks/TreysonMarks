import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchProfile, upsertProfile } from '../lib/api'
import type { Profile } from '../lib/types'

const DEFAULT_PROFILE = (userId: string): Profile => ({
  user_id: userId,
  sex: 'male',
  birthdate: '1990-01-01',
  height_cm: 175,
  weight_kg: 75,
  activity_level: 'light',
  goal_type: 'maintain',
  units: 'metric',
})

export function useProfile() {
  const { session } = useAuth()
  const userId = session?.user.id
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const existing = await fetchProfile(userId)
      setProfile(existing ?? DEFAULT_PROFILE(userId))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const save = useCallback(
    async (next: Profile) => {
      const saved = await upsertProfile(next)
      setProfile(saved)
      return saved
    },
    [],
  )

  return { profile, loading, error, save, reload: load }
}
