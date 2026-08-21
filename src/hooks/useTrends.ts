import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  fetchExerciseRange,
  fetchFoodRange,
  fetchWeightRange,
  fetchWorkoutsRange,
} from '../lib/api'
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
  protein: number
  carbs: number
  fat: number
}

export interface WeightPoint {
  date: string
  weight: number
  avg: number
}

export interface CategoryTotal {
  category: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

export function useTrends(days: number, profile: Profile | null) {
  const { session } = useAuth()
  const userId = session?.user.id
  const [points, setPoints] = useState<DayPoint[]>([])
  const [weights, setWeights] = useState<WeightPoint[]>([])
  const [byCategory, setByCategory] = useState<CategoryTotal[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId || !profile) return
    setLoading(true)
    const from = shiftDay(isoDay(), -(days - 1))

    const [food, exercise, workouts, weightLogs] = await Promise.all([
      fetchFoodRange(userId, from),
      fetchExerciseRange(userId, from),
      fetchWorkoutsRange(userId, from),
      fetchWeightRange(userId, from),
    ])

    // Build a dense day series so the chart has no gaps.
    const series: DayPoint[] = []
    for (let i = 0; i < days; i++) {
      const date = shiftDay(from, i)
      const on = parseISO(date)
      const dayFood = food.filter((f) => f.date === date)
      const intake = dayFood.reduce((s, f) => s + f.calories * f.quantity, 0)
      const protein = dayFood.reduce((s, f) => s + (f.protein_g ?? 0) * f.quantity, 0)
      const carbs = dayFood.reduce((s, f) => s + (f.carbs_g ?? 0) * f.quantity, 0)
      const fat = dayFood.reduce((s, f) => s + (f.fat_g ?? 0) * f.quantity, 0)
      const exBurn = exercise
        .filter((e) => e.date === date)
        .reduce((s, e) => s + e.calories_burned, 0)
      const workoutBurn = workouts
        .filter((w) => w.date === date)
        .reduce((s, w) => s + (w.calories_burned ?? 0), 0)
      const baseline = baselineBurn(profile, on)
      const out = baseline + exBurn + workoutBurn
      series.push({
        date,
        intake: Math.round(intake),
        out: Math.round(out),
        net: Math.round(intake - out),
        target: intakeTarget(profile, on),
        protein: Math.round(protein),
        carbs: Math.round(carbs),
        fat: Math.round(fat),
      })
    }

    // Aggregate calories + macros by category across the whole range.
    const catMap = new Map<string, CategoryTotal>()
    for (const f of food) {
      const key = f.category || 'Other'
      const t = catMap.get(key) ?? { category: key, calories: 0, protein: 0, carbs: 0, fat: 0 }
      t.calories += f.calories * f.quantity
      t.protein += (f.protein_g ?? 0) * f.quantity
      t.carbs += (f.carbs_g ?? 0) * f.quantity
      t.fat += (f.fat_g ?? 0) * f.quantity
      catMap.set(key, t)
    }
    const cats = [...catMap.values()]
      .map((c) => ({
        category: c.category,
        calories: Math.round(c.calories),
        protein: Math.round(c.protein),
        carbs: Math.round(c.carbs),
        fat: Math.round(c.fat),
      }))
      .sort((a, b) => b.calories - a.calories)

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
    setByCategory(cats)
    setLoading(false)
  }, [userId, profile, days])

  useEffect(() => {
    void load()
  }, [load])

  return { points, weights, byCategory, loading, reload: load }
}
