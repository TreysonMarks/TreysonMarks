import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useBody } from '../hooks/useBody'
import { useProfile } from '../hooks/useProfile'
import { isoDay, shortDay } from '../lib/date'
import { kgToLb, lbToKg, round1 } from '../lib/units'
import type { BodyMeasurement } from '../lib/types'
import Spinner from './Spinner'

type MetricKey = 'body_fat_pct' | 'skeletal_muscle_kg' | 'weight_kg' | 'visceral_fat' | 'bmr'

export default function BodyComposition() {
  const { measurements, loading, add, remove } = useBody()
  const { profile } = useProfile()
  const imperial = profile?.units === 'imperial'
  const [metric, setMetric] = useState<MetricKey>('body_fat_pct')
  const [adding, setAdding] = useState(false)

  const wUnit = imperial ? 'lb' : 'kg'
  const METRICS: { key: MetricKey; label: string; unit: string; convert: boolean }[] = [
    { key: 'body_fat_pct', label: 'Body fat', unit: '%', convert: false },
    { key: 'skeletal_muscle_kg', label: 'Skeletal muscle', unit: wUnit, convert: true },
    { key: 'weight_kg', label: 'Weight', unit: wUnit, convert: true },
    { key: 'visceral_fat', label: 'Visceral fat', unit: '', convert: false },
    { key: 'bmr', label: 'BMR', unit: 'kcal', convert: false },
  ]

  const disp = (v: number | null, convert: boolean) =>
    v == null ? null : convert && imperial ? round1(kgToLb(v)) : round1(v)

  const active = METRICS.find((m) => m.key === metric)!
  const chartData = useMemo(
    () =>
      measurements
        .filter((m) => m[metric] != null)
        .map((m) => ({ label: shortDay(m.date), value: disp(m[metric], active.convert) })),
    [measurements, metric, active.convert, imperial],
  )
  const latest = measurements[measurements.length - 1]

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-300">Body composition</h2>
        <button className="text-xs text-accent" onClick={() => setAdding((s) => !s)}>
          {adding ? 'Close' : '+ Measurement'}
        </button>
      </div>

      {adding && (
        <AddMeasurement
          imperial={imperial}
          onSave={async (v) => {
            await add(v)
            setAdding(false)
          }}
        />
      )}

      {loading ? (
        <Spinner full />
      ) : measurements.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">
          Log an InBody scan or any body measurement to see trends.
        </p>
      ) : (
        <>
          {/* Latest snapshot */}
          {latest && (
            <div className="grid grid-cols-3 gap-2 text-center">
              {METRICS.slice(0, 3).map((m) => (
                <div key={m.key}>
                  <div className="text-lg font-bold tabular-nums text-slate-100">
                    {disp(latest[m.key], m.convert) ?? '—'}
                    {m.unit && latest[m.key] != null && (
                      <span className="ml-0.5 text-xs text-slate-500">{m.unit}</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">{m.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Metric selector */}
          <div className="flex flex-wrap gap-1.5">
            {METRICS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMetric(m.key)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  metric === m.key ? 'bg-accent text-slate-950' : 'bg-base-bg text-slate-400'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#1e2a44" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} width={44} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{
                    background: '#0b1120',
                    border: '1px solid #1e2a44',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="value" name={active.label} stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-6 text-center text-sm text-slate-500">No {active.label} logged.</p>
          )}

          {/* Recent list */}
          <div className="space-y-1 border-t border-base-border pt-2">
            {[...measurements].reverse().slice(0, 5).map((m) => (
              <div key={m.id} className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{shortDay(m.date)}</span>
                <span className="text-slate-300">
                  {m.body_fat_pct != null && `${round1(m.body_fat_pct)}% bf`}
                  {m.skeletal_muscle_kg != null &&
                    ` · ${disp(m.skeletal_muscle_kg, true)}${wUnit} SMM`}
                </span>
                <button
                  onClick={() => remove(m.id)}
                  className="text-slate-600 hover:text-bad"
                  aria-label="Delete measurement"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function AddMeasurement({
  imperial,
  onSave,
}: {
  imperial: boolean
  onSave: (v: Omit<BodyMeasurement, 'id' | 'created_at' | 'user_id'>) => Promise<void>
}) {
  const [date, setDate] = useState(isoDay())
  const [f, setF] = useState({
    weight: '',
    bodyFat: '',
    smm: '',
    fatMass: '',
    visceral: '',
    bmr: '',
    notes: '',
  })
  const [busy, setBusy] = useState(false)
  const wUnit = imperial ? 'lb' : 'kg'

  const toKg = (v: string) => {
    if (!v) return null
    const n = Number(v)
    return imperial ? lbToKg(n) : n
  }
  const num = (v: string) => (v ? Number(v) : null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await onSave({
        date,
        weight_kg: toKg(f.weight),
        body_fat_pct: num(f.bodyFat),
        skeletal_muscle_kg: toKg(f.smm),
        body_fat_mass_kg: toKg(f.fatMass),
        visceral_fat: num(f.visceral),
        bmr: num(f.bmr),
        notes: f.notes.trim() || null,
      })
    } finally {
      setBusy(false)
    }
  }

  const field = (key: keyof typeof f, label: string) => (
    <div>
      <label className="label">{label}</label>
      <input
        className="input px-2.5 py-2 text-sm"
        type={key === 'notes' ? 'text' : 'number'}
        inputMode="decimal"
        value={f[key]}
        onChange={(e) => setF({ ...f, [key]: e.target.value })}
      />
    </div>
  )

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-base-border bg-base-bg p-3">
      <div>
        <label className="label">Date</label>
        <input
          type="date"
          className="input"
          value={date}
          max={isoDay()}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {field('weight', `Weight (${wUnit})`)}
        {field('bodyFat', 'Body fat %')}
        {field('smm', `Skeletal muscle (${wUnit})`)}
        {field('fatMass', `Fat mass (${wUnit})`)}
        {field('visceral', 'Visceral fat')}
        {field('bmr', 'BMR (kcal)')}
      </div>
      {field('notes', 'Notes')}
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? 'Saving…' : 'Save measurement'}
      </button>
    </form>
  )
}
