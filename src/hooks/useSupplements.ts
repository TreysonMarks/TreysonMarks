import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  addSupplement,
  deleteSupplement,
  deleteSupplementLog,
  fetchSupplementLogs,
  fetchSupplements,
  logSupplement,
  updateSupplement,
} from '../lib/api'
import type { Supplement, SupplementLog } from '../lib/types'

export type DueStatus = 'overdue' | 'due' | 'upcoming' | 'as_needed'

export interface SupplementView {
  supplement: Supplement
  lastTaken: string | null
  nextDue: Date | null
  status: DueStatus
  /** Whole days until due (negative = overdue). Null when as-needed. */
  daysUntilDue: number | null
}

const DAY_MS = 86_400_000

function deriveView(sup: Supplement, logs: SupplementLog[]): SupplementView {
  const mine = logs
    .filter((l) => l.supplement_id === sup.id)
    .sort((a, b) => b.taken_at.localeCompare(a.taken_at))
  const lastTaken = mine[0]?.taken_at ?? null

  if (!sup.cadence_days || sup.cadence_days <= 0) {
    return { supplement: sup, lastTaken, nextDue: null, status: 'as_needed', daysUntilDue: null }
  }

  const now = Date.now()
  if (!lastTaken) {
    return {
      supplement: sup,
      lastTaken,
      nextDue: new Date(now),
      status: 'due',
      daysUntilDue: 0,
    }
  }

  const nextMs = new Date(lastTaken).getTime() + sup.cadence_days * DAY_MS
  const daysUntilDue = Math.ceil((nextMs - now) / DAY_MS)
  let status: DueStatus = 'upcoming'
  if (nextMs < now) status = 'overdue'
  else if (daysUntilDue <= 0) status = 'due'

  return { supplement: sup, lastTaken, nextDue: new Date(nextMs), status, daysUntilDue }
}

export function useSupplements() {
  const { session } = useAuth()
  const userId = session?.user.id
  const [supplements, setSupplements] = useState<Supplement[]>([])
  const [logs, setLogs] = useState<SupplementLog[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const [sups, ls] = await Promise.all([
      fetchSupplements(userId),
      fetchSupplementLogs(userId),
    ])
    setSupplements(sups)
    setLogs(ls)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const create = useCallback(
    async (entry: Omit<Supplement, 'id' | 'created_at' | 'user_id'>) => {
      if (!userId) return
      const created = await addSupplement({ ...entry, user_id: userId })
      setSupplements((prev) => [...prev, created])
    },
    [userId],
  )

  const update = useCallback(async (id: string, patch: Partial<Supplement>) => {
    await updateSupplement(id, patch)
    setSupplements((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }, [])

  const remove = useCallback(async (id: string) => {
    await deleteSupplement(id)
    setSupplements((prev) => prev.filter((s) => s.id !== id))
    setLogs((prev) => prev.filter((l) => l.supplement_id !== id))
  }, [])

  const take = useCallback(
    async (sup: Supplement, when: Date = new Date()) => {
      if (!userId) return
      const created = await logSupplement({
        user_id: userId,
        supplement_id: sup.id,
        taken_at: when.toISOString(),
        dose: sup.dose ?? null,
        note: null,
      })
      setLogs((prev) => [created, ...prev])
    },
    [userId],
  )

  const undoLog = useCallback(async (logId: string) => {
    await deleteSupplementLog(logId)
    setLogs((prev) => prev.filter((l) => l.id !== logId))
  }, [])

  const views = useMemo(
    () => supplements.map((s) => deriveView(s, logs)),
    [supplements, logs],
  )

  return { views, logs, loading, create, update, remove, take, undoLog, reload: load }
}
