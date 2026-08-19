import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchExerciseRange, fetchFoodRange, fetchWeightRange } from '../lib/api'
import { baselineBurn, intakeTarget } from '../lib/tdee'
import { isoDay, shiftDay } from '../lib/date'
import type { Profile } from '../lib/types'
import { parseISO } from 'date-fns'

export interface DayPoint {
  date: string
  intake: number
  out: number
  net: number
  target: number
}

export interface WeightPoint {
  date: string
  weight: number
  avg: number
}

export function useTrends(days: number, profile: Profile | null) {
  const { session } = useAuth()
  const userId = session?.user.id
  const [points, setPoints] = useState<DayPoint[]>([])
  const [weights, setWeights] = useState<WeightPoint[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId || !profile) return
    setLoading(true)
    const from = shiftDay(isoDay(), -(days - 1))

    const [food, exercise, weightLogs] = await Promise.all([
      fetchFoodRange(userId, from),
      fetchExerciseRange(userId, from),
      fetchWeightRange(userId, from),
    ])

    // Build a dense day series so the chart has no gaps.
    const series: DayPoint[] = []
    for (let i = 0; i < days; i++) {
      const date = shiftDay(from, i)
      const on = parseISO(date)
      const intake = food
        .filter((f) => f.date === date)
        .reduce((s, f) => s + f.calories * f.quantity, 0)
      const exBurn = exercise
        .filter((e) => e.date === date)
        .reduce((s, e) => s + e.calories_burned, 0)
      const baseline = baselineBurn(profile, on)
      const out = baseline + exBurn
      series.push({
        date,
        intake: Math.round(intake),
        out: Math.round(out),
        net: Math.round(intake - out),
        target: intakeTarget(profile, on),
      })
    }

    // Weight with 7-day rolling average.
    const wSorted = [...weightLogs].sort((a, b) => a.date.localeCompare(b.date))
    const wSeries: WeightPoint[] = wSorted.map((w, idx) => {
      const window = wSorted.slice(Math.max(0, idx - 6), idx + 1)
      const avg = window.reduce((s, x) => s + x.weight_kg, 0) / window.length
      return {
        date: w.date,
        weight: Number(w.weight_kg),
        avg: Math.round(avg * 10) / 10,
      }
    })

    setPoints(series)
    setWeights(wSeries)
    setLoading(false)
  }, [userId, profile, days])

  useEffect(() => {
    void load()
  }, [load])

  return { points, weights, loading, reload: load }
}
