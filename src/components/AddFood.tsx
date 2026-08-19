import { useState } from 'react'
import type { ParsedFood } from '../lib/types'
import { parseFood } from '../lib/api'

interface Props {
  categories: string[]
  aiAvailable: boolean
  onAdd: (item: ParsedFood) => Promise<void>
  onAddMany: (items: ParsedFood[]) => Promise<void>
}

const EMPTY: ParsedFood = {
  name: '',
  calories: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  category: 'Other',
  quantity: 1,
}

export default function AddFood({ categories, aiAvailable, onAdd, onAddMany }: Props) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'ai' | 'manual'>(aiAvailable ? 'ai' : 'manual')

  if (!open) {
    return (
      <button className="btn-ghost w-full border-dashed text-slate-300" onClick={() => setOpen(true)}>
        + Add food
      </button>
    )
  }

  return (
    <div className="card space-y-4">
      <div className="flex gap-1 rounded-xl border border-base-border p-1">
        <TabBtn active={mode === 'ai'} onClick={() => setMode('ai')}>
          ✨ Describe
        </TabBtn>
        <TabBtn active={mode === 'manual'} onClick={() => setMode('manual')}>
          Manual
        </TabBtn>
      </div>

      {mode === 'ai' ? (
        <AiMode
          categories={categories}
          aiAvailable={aiAvailable}
          onAddMany={onAddMany}
          onDone={() => setOpen(false)}
        />
      ) : (
        <ManualMode categories={categories} onAdd={onAdd} onDone={() => setOpen(false)} />
      )}

      <button className="w-full text-center text-xs text-slate-500" onClick={() => setOpen(false)}>
        Close
      </button>
    </div>
  )
}

function TabBtn({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 rounded-lg py-2 text-sm font-medium transition disabled:opacity-30 ${
        active ? 'bg-accent text-slate-950' : 'text-slate-400'
      }`}
    >
      {children}
    </button>
  )
}

function AiMode({
  categories,
  aiAvailable,
  onAddMany,
  onDone,
}: {
  categories: string[]
  aiAvailable: boolean
  onAddMany: (items: ParsedFood[]) => Promise<void>
  onDone: () => void
}) {
  const [text, setText] = useState('')
  const [items, setItems] = useState<ParsedFood[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function doParse() {
    if (!text.trim()) return
    setBusy(true)
    setError(null)
    try {
      const parsed = await parseFood(text.trim(), categories)
      setItems(parsed.length ? parsed : [])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function saveAll() {
    if (!items?.length) return
    setBusy(true)
    try {
      await onAddMany(items)
      onDone()
    } finally {
      setBusy(false)
    }
  }

  if (items) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-slate-400">
          Claude's estimate — tweak anything, then save.
        </p>
        {items.length === 0 && (
          <p className="text-sm text-slate-500">Nothing found. Try rephrasing.</p>
        )}
        {items.map((it, i) => (
          <ItemEditor
            key={i}
            item={it}
            categories={categories}
            onChange={(next) =>
              setItems((prev) => prev!.map((x, j) => (j === i ? next : x)))
            }
            onRemove={() => setItems((prev) => prev!.filter((_, j) => j !== i))}
          />
        ))}
        <div className="flex gap-2">
          <button className="btn-primary flex-1" onClick={saveAll} disabled={busy || !items.length}>
            {busy ? 'Saving…' : `Save ${items.length} item${items.length === 1 ? '' : 's'}`}
          </button>
          <button className="btn-ghost" onClick={() => setItems(null)}>
            Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {!aiAvailable && (
        <p className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
          Add your Anthropic API key in <b>Profile → AI food parsing</b> and hit Save to enable
          this. Until then, use the Manual tab.
        </p>
      )}
      <textarea
        autoFocus
        className="input min-h-[90px]"
        placeholder="e.g. two eggs, a banana, and a protein shake — or paste a nutrition label"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {error && <p className="text-sm text-bad">{error}</p>}
      <button className="btn-primary w-full" onClick={doParse} disabled={busy || !text.trim()}>
        {busy ? 'Asking Claude…' : 'Parse with Claude'}
      </button>
    </div>
  )
}

function ManualMode({
  categories,
  onAdd,
  onDone,
}: {
  categories: string[]
  onAdd: (item: ParsedFood) => Promise<void>
  onDone: () => void
}) {
  const [item, setItem] = useState<ParsedFood>({ ...EMPTY, category: categories[0] ?? 'Other' })
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!item.name.trim()) return
    setBusy(true)
    try {
      await onAdd({ ...item, name: item.name.trim() })
      onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <ItemEditor item={item} categories={categories} onChange={setItem} />
      <button className="btn-primary w-full" onClick={submit} disabled={busy || !item.name.trim()}>
        {busy ? 'Saving…' : 'Add'}
      </button>
    </div>
  )
}

function ItemEditor({
  item,
  categories,
  onChange,
  onRemove,
}: {
  item: ParsedFood
  categories: string[]
  onChange: (next: ParsedFood) => void
  onRemove?: () => void
}) {
  const set = <K extends keyof ParsedFood>(k: K, v: ParsedFood[K]) => onChange({ ...item, [k]: v })
  const opts = categories.includes(item.category) ? categories : [item.category, ...categories]

  return (
    <div className="space-y-2 rounded-xl border border-base-border bg-base-bg p-3">
      <div className="flex gap-2">
        <input
          className="input"
          placeholder="Food name"
          value={item.name}
          onChange={(e) => set('name', e.target.value)}
        />
        {onRemove && (
          <button
            onClick={onRemove}
            className="rounded-lg px-2 text-slate-500 hover:text-bad"
            aria-label="Remove item"
          >
            ✕
          </button>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2">
        <NumField label="kcal" value={item.calories} onChange={(v) => set('calories', v)} />
        <NumField label="P" value={item.protein_g} onChange={(v) => set('protein_g', v)} />
        <NumField label="C" value={item.carbs_g} onChange={(v) => set('carbs_g', v)} />
        <NumField label="F" value={item.fat_g} onChange={(v) => set('fat_g', v)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Servings</label>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            value={item.quantity}
            onChange={(e) => set('quantity', Number(e.target.value) || 1)}
          />
        </div>
        <div>
          <label className="label">Category</label>
          <select
            className="input"
            value={item.category}
            onChange={(e) => set('category', e.target.value)}
          >
            {opts.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        className="input px-2"
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  )
}
