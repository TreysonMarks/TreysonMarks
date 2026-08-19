import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { createWorkout, deleteWorkout, fetchWorkouts, type NewWorkout } from '../lib/api'
import type { WorkoutWithExercises } from '../lib/types'

export function useWorkouts() {
  const { session } = useAuth()
  const userId = session?.user.id
  const [workouts, setWorkouts] = useState<WorkoutWithExercises[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setWorkouts(await fetchWorkouts(userId))
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const create = useCallback(
    async (w: NewWorkout) => {
      if (!userId) return
      const created = await createWorkout(userId, w)
      setWorkouts((prev) =>
        [created, ...prev].sort((a, b) => b.date.localeCompare(a.date)),
      )
    },
    [userId],
  )

  const remove = useCallback(async (id: string) => {
    await deleteWorkout(id)
    setWorkouts((prev) => prev.filter((w) => w.id !== id))
  }, [])

  return { workouts, loading, create, remove, reload: load }
}
