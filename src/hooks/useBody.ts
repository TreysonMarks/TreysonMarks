import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  addBodyMeasurement,
  deleteBodyMeasurement,
  fetchBodyMeasurements,
} from '../lib/api'
import type { BodyMeasurement } from '../lib/types'

export function useBody() {
  const { session } = useAuth()
  const userId = session?.user.id
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setMeasurements(await fetchBodyMeasurements(userId))
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const add = useCallback(
    async (entry: Omit<BodyMeasurement, 'id' | 'created_at' | 'user_id'>) => {
      if (!userId) return
      const created = await addBodyMeasurement({ ...entry, user_id: userId })
      setMeasurements((prev) =>
        [...prev, created].sort((a, b) => a.date.localeCompare(b.date)),
      )
    },
    [userId],
  )

  const remove = useCallback(async (id: string) => {
    await deleteBodyMeasurement(id)
    setMeasurements((prev) => prev.filter((m) => m.id !== id))
  }, [])

  return { measurements, loading, add, remove, reload: load }
}
