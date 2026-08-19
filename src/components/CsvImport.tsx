import { useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { importFood } from '../lib/api'
import { guessColumn, normalizeDate, parseCsv, parseNum } from '../lib/csv'
import type { FoodEntry } from '../lib/types'

type Field = 'date' | 'name' | 'calories' | 'protein' | 'carbs' | 'fat' | 'category'

const FIELDS: { key: Field; label: string; keywords: string[] }[] = [
  { key: 'date', label: 'Date *', keywords: ['date', 'day'] },
  { key: 'name', label: 'Food name', keywords: ['name', 'food', 'item', 'meal', 'desc'] },
  { key: 'calories', label: 'Calories *', keywords: ['calor', 'kcal', 'energy'] },
  { key: 'protein', label: 'Protein (g)', keywords: ['protein'] },
  { key: 'carbs', label: 'Carbs (g)', keywords: ['carb'] },
  { key: 'fat', label: 'Fat (g)', keywords: ['fat'] },
  { key: 'category', label: 'Category', keywords: ['categ', 'group', 'type'] },
]

export default function CsvImport({ onImported }: { onImported?: () => void }) {
  const { session } = useAuth()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<string[][] | null>(null)
  const [map, setMap] = useState<Record<Field, number>>({
    date: -1,
    name: -1,
    calories: -1,
    protein: -1,
    carbs: -1,
    fat: -1,
    category: -1,
  })
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  function ingest(text: string) {
    const parsed = parseCsv(text)
    if (parsed.length < 2) {
      setResult('Need a header row plus at least one data row.')
      return
    }
    const headers = parsed[0]
    setRows(parsed)
    setResult(null)
    const next = {} as Record<Field, number>
    for (const f of FIELDS) next[f.key] = guessColumn(headers, f.keywords)
    setMap(next)
  }

  const headers = rows?.[0] ?? []
  const dataRows = rows?.slice(1) ?? []

  const entries = useMemo(() => {
    if (!rows || !session) return []
    const out: Omit<FoodEntry, 'id' | 'created_at'>[] = []
    for (const r of dataRows) {
      const date = map.date >= 0 ? normalizeDate(r[map.date] ?? '') : null
      if (!date) continue
      out.push({
        user_id: session.user.id,
        date,
        name: map.name >= 0 ? r[map.name]?.trim() || 'Imported' : 'Imported',
        calories: map.calories >= 0 ? parseNum(r[map.calories]) : 0,
        quantity: 1,
        protein_g: map.protein >= 0 ? parseNum(r[map.protein]) : 0,
        carbs_g: map.carbs >= 0 ? parseNum(r[map.carbs]) : 0,
        fat_g: map.fat >= 0 ? parseNum(r[map.fat]) : 0,
        category: map.category >= 0 ? r[map.category]?.trim() || 'Other' : 'Other',
      })
    }
    return out
  }, [rows, map, session, dataRows])

  const skipped = dataRows.length - entries.length

  async function runImport() {
    if (entries.length === 0) return
    setBusy(true)
    setResult(null)
    try {
      const n = await importFood(entries)
      setResult(`Imported ${n} entries.${skipped > 0 ? ` Skipped ${skipped} (no valid date).` : ''}`)
      setRows(null)
      onImported?.()
    } catch (e) {
      setResult(`Import failed: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button className="btn-ghost w-full border-dashed text-sm" onClick={() => setOpen(true)}>
        Import food log from CSV
      </button>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-300">Import food log (CSV)</span>
        <button
          className="text-xs text-slate-500"
          onClick={() => {
            setOpen(false)
            setRows(null)
            setResult(null)
          }}
        >
          Close
        </button>
      </div>

      {!rows ? (
        <>
          <p className="text-xs text-slate-500">
            Export your spreadsheet as CSV, then upload it or paste it below. The first row must be
            column headers.
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-slate-950"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (file) ingest(await file.text())
            }}
          />
          <textarea
            className="input min-h-[90px] font-mono text-xs"
            placeholder="date,calories,protein,carbs,fat&#10;2026-08-05,2100,180,150,70"
            onChange={(e) => {
              if (e.target.value.trim()) ingest(e.target.value)
            }}
          />
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label className="label">{f.label}</label>
                <select
                  className="input px-2 py-1.5 text-sm"
                  value={map[f.key]}
                  onChange={(e) => setMap({ ...map, [f.key]: Number(e.target.value) })}
                >
                  <option value={-1}>—</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Column ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-base-border bg-base-bg p-2 text-xs text-slate-400">
            <div className="mb-1 font-medium text-slate-300">
              Preview — {entries.length} rows ready{skipped > 0 ? `, ${skipped} skipped` : ''}
            </div>
            {entries.slice(0, 4).map((e, i) => (
              <div key={i} className="tabular-nums">
                {e.date} · {e.name} · {e.calories}kcal · {e.protein_g}p {e.carbs_g}c {e.fat_g}f
              </div>
            ))}
          </div>

          <button
            className="btn-primary w-full"
            onClick={runImport}
            disabled={busy || entries.length === 0}
          >
            {busy ? 'Importing…' : `Import ${entries.length} entries`}
          </button>
          <button className="w-full text-center text-xs text-slate-500" onClick={() => setRows(null)}>
            Start over
          </button>
        </>
      )}

      {result && <p className="text-sm text-good">{result}</p>}
    </div>
  )
}
