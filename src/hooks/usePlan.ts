import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  addPlannedWorkout,
  deletePlanDay,
  deletePlannedWorkout,
  fetchPlanDays,
  fetchPlannedRange,
  fetchWorkoutsByDate,
  replacePlanTemplate,
  upsertPlanDay,
} from '../lib/api'
import type { ParsedPlanDay, PlanDay, PlannedWorkout } from '../lib/types'
import { isoDay, shiftDay } from '../lib/date'
import { parseISO } from 'date-fns'

export interface PlanDayView {
  date: string
  weekday: number
  template: PlanDay | null
  oneOffs: PlannedWorkout[]
  loggedCount: number
}

/** Sunday-start ISO date for the week containing `iso`. */
export function weekStartOf(iso: string): string {
  const d = parseISO(iso)
  return shiftDay(iso, -d.getDay())
}

export function usePlan(weekStart: string) {
  const { session } = useAuth()
  const userId = session?.user.id
  const [template, setTemplate] = useState<PlanDay[]>([])
  const [days, setDays] = useState<PlanDayView[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const weekEnd = shiftDay(weekStart, 6)
    const dates = Array.from({ length: 7 }, (_, i) => shiftDay(weekStart, i))

    const [tpl, oneOffs, ...loggedPerDay] = await Promise.all([
      fetchPlanDays(userId),
      fetchPlannedRange(userId, weekStart, weekEnd),
      ...dates.map((d) => fetchWorkoutsByDate(userId, d)),
    ])

    const views: PlanDayView[] = dates.map((date, i) => {
      const weekday = parseISO(date).getDay()
      return {
        date,
        weekday,
        template: tpl.find((t) => t.weekday === weekday) ?? null,
        oneOffs: oneOffs.filter((o) => o.date === date),
        loggedCount: loggedPerDay[i].length,
      }
    })

    setTemplate(tpl)
    setDays(views)
    setLoading(false)
  }, [userId, weekStart])

  useEffect(() => {
    void load()
  }, [load])

  const saveTemplateDay = useCallback(
    async (day: Omit<PlanDay, 'id' | 'user_id' | 'created_at'>) => {
      if (!userId) return
      await upsertPlanDay(userId, day)
      await load()
    },
    [userId, load],
  )

  const clearTemplateDay = useCallback(
    async (id: string) => {
      await deletePlanDay(id)
      await load()
    },
    [load],
  )

  const applyGeneratedPlan = useCallback(
    async (generated: ParsedPlanDay[]) => {
      if (!userId) return
      await replacePlanTemplate(userId, generated)
      await load()
    },
    [userId, load],
  )

  const addOneOff = useCallback(
    async (entry: Omit<PlannedWorkout, 'id' | 'created_at' | 'user_id'>) => {
      if (!userId) return
      await addPlannedWorkout({ ...entry, user_id: userId })
      await load()
    },
    [userId, load],
  )

  const removeOneOff = useCallback(
    async (id: string) => {
      await deletePlannedWorkout(id)
      await load()
    },
    [load],
  )

  return {
    template,
    days,
    loading,
    isToday: (d: string) => d === isoDay(),
    saveTemplateDay,
    clearTemplateDay,
    applyGeneratedPlan,
    addOneOff,
    removeOneOff,
    reload: load,
  }
}
