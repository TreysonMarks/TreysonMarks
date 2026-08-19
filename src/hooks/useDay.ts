import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  addExercise,
  addFood,
  deleteExercise,
  deleteFood,
  deleteWorkout,
  fetchExercise,
  fetchFood,
  fetchWorkoutsByDate,
} from '../lib/api'
import { baselineBurn, intakeTarget } from '../lib/tdee'
import type {
  DayTotals,
  ExerciseEntry,
  FoodEntry,
  ParsedFood,
  Profile,
  Workout,
} from '../lib/types'
import { parseISO } from 'date-fns'

export function computeTotals(
  food: FoodEntry[],
  exercise: ExerciseEntry[],
  workouts: Workout[],
  profile: Profile | null,
  date: string,
): DayTotals {
  const intake = food.reduce((s, f) => s + f.calories * f.quantity, 0)
  const protein = food.reduce((s, f) => s + (f.protein_g ?? 0) * f.quantity, 0)
  const carbs = food.reduce((s, f) => s + (f.carbs_g ?? 0) * f.quantity, 0)
  const fat = food.reduce((s, f) => s + (f.fat_g ?? 0) * f.quantity, 0)
  const exerciseBurn =
    exercise.reduce((s, e) => s + e.calories_burned, 0) +
    workouts.reduce((s, w) => s + w.calories_burned, 0)
  const on = parseISO(date)
  const baseline = profile ? baselineBurn(profile, on) : 0
  const target = profile ? intakeTarget(profile, on) : 0
  const totalOut = baseline + exerciseBurn
  return {
    intake: Math.round(intake),
    exercise: Math.round(exerciseBurn),
    baselineBurn: baseline,
    totalOut: Math.round(totalOut),
    net: Math.round(intake - totalOut),
    target,
    remaining: Math.round(target + exerciseBurn - intake),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
  }
}

export function useDay(date: string, profile: Profile | null) {
  const { session } = useAuth()
  const userId = session?.user.id
  const [food, setFood] = useState<FoodEntry[]>([])
  const [exercise, setExercise] = useState<ExerciseEntry[]>([])
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const [f, e, w] = await Promise.all([
      fetchFood(userId, date),
      fetchExercise(userId, date),
      fetchWorkoutsByDate(userId, date),
    ])
    setFood(f)
    setExercise(e)
    setWorkouts(w)
    setLoading(false)
  }, [userId, date])

  useEffect(() => {
    void load()
  }, [load])

  const logFood = useCallback(
    async (item: ParsedFood) => {
      if (!userId) return
      const created = await addFood({ user_id: userId, date, ...item })
      setFood((prev) => [...prev, created])
    },
    [userId, date],
  )

  const logFoods = useCallback(
    async (items: ParsedFood[]) => {
      if (!userId || items.length === 0) return
      for (const item of items) {
        const created = await addFood({ user_id: userId, date, ...item })
        setFood((prev) => [...prev, created])
      }
    },
    [userId, date],
  )

  const logExercise = useCallback(
    async (name: string, caloriesBurned: number, minutes: number | null) => {
      if (!userId) return
      const created = await addExercise({
        user_id: userId,
        date,
        name,
        calories_burned: caloriesBurned,
        minutes,
      })
      setExercise((prev) => [...prev, created])
    },
    [userId, date],
  )

  const removeFood = useCallback(async (id: string) => {
    await deleteFood(id)
    setFood((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const removeExercise = useCallback(async (id: string) => {
    await deleteExercise(id)
    setExercise((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const removeWorkout = useCallback(async (id: string) => {
    await deleteWorkout(id)
    setWorkouts((prev) => prev.filter((w) => w.id !== id))
  }, [])

  const totals = computeTotals(food, exercise, workouts, profile, date)

  return {
    food,
    exercise,
    workouts,
    totals,
    loading,
    logFood,
    logFoods,
    logExercise,
    removeFood,
    removeExercise,
    removeWorkout,
  }
}
