import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  addCategory,
  deleteCategory,
  fetchCategories,
  seedCategories,
} from '../lib/api'
import type { Category } from '../lib/types'

export function useCategories() {
  const { session } = useAuth()
  const userId = session?.user.id
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    let cats = await fetchCategories(userId)
    if (cats.length === 0) {
      // First run for this user — seed the starter set.
      cats = await seedCategories(userId)
    }
    setCategories(cats)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const add = useCallback(
    async (name: string) => {
      if (!userId || !name.trim()) return
      const created = await addCategory(userId, name.trim(), categories.length)
      setCategories((prev) => [...prev, created])
    },
    [userId, categories.length],
  )

  const remove = useCallback(async (id: string) => {
    await deleteCategory(id)
    setCategories((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const names = categories.map((c) => c.name)

  return { categories, names, loading, add, remove, reload: load }
}
