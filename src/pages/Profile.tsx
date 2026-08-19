import { useEffect, useState } from 'react'
import { useProfile } from '../hooks/useProfile'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  ACTIVITY_LABELS,
  GOAL_LABELS,
  ageFromBirthdate,
  baselineBurn,
  intakeTarget,
} from '../lib/tdee'
import { upsertWeight } from '../lib/api'
import { isoDay } from '../lib/date'
import {
  cmToFtIn,
  ftInToCm,
  kgToLb,
  lbToKg,
  round1,
} from '../lib/units'
import type {
  ActivityLevel,
  GoalType,
  Profile,
  Sex,
  Units,
} from '../lib/types'
import Spinner from '../components/Spinner'

export default function ProfilePage() {
  const { session } = useAuth()
  const { profile, loading, save } = useProfile()
  const [draft, setDraft] = useState<Profile | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (profile) setDraft(profile)
  }, [profile])

  if (loading || !draft) return <Spinner full />

  const imperial = draft.units === 'imperial'

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d))
    setStatus(null)
  }

  async function onSave() {
    if (!draft) return
    setBusy(true)
    setStatus(null)
    try {
      await save(draft)
      // Keep a weight log point in step with the profile weight.
      if (session) {
        await upsertWeight({
          user_id: session.user.id,
          date: isoDay(),
          weight_kg: round1(draft.weight_kg),
        })
      }
      setStatus('Saved ✓')
    } catch (e) {
      setStatus((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const age = ageFromBirthdate(draft.birthdate)
  const burn = baselineBurn(draft)
  const target = intakeTarget(draft)
  const { ft, inch } = cmToFtIn(draft.height_cm)

  return (
    <div className="space-y-5 pb-4">
      <h1 className="text-lg font-bold">Profile</h1>

      {/* Live TDEE summary */}
      <div className="card">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Metric label="Age" value={`${age}`} />
          <Metric label="Baseline burn" value={`${burn}`} unit="kcal" />
          <Metric label="Daily target" value={`${target}`} unit="kcal" />
        </div>
      </div>

      {/* Body */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-slate-300">Body</h2>

        <Segmented<Sex>
          label="Sex"
          value={draft.sex}
          onChange={(v) => set('sex', v)}
          options={[
            { value: 'male', label: 'Male' },
            { value: 'female', label: 'Female' },
          ]}
        />

        <div>
          <label className="label">Birthdate</label>
          <input
            type="date"
            className="input"
            value={draft.birthdate}
            max={isoDay()}
            onChange={(e) => set('birthdate', e.target.value)}
          />
        </div>

        {/* Height */}
        <div>
          <label className="label">Height</label>
          {imperial ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  className="input"
                  value={ft}
                  onChange={(e) =>
                    set('height_cm', ftInToCm(Number(e.target.value) || 0, inch))
                  }
                />
                <span className="text-sm text-slate-400">ft</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  className="input"
                  value={inch}
                  onChange={(e) =>
                    set('height_cm', ftInToCm(ft, Number(e.target.value) || 0))
                  }
                />
                <span className="text-sm text-slate-400">in</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="number"
                className="input"
                value={Math.round(draft.height_cm)}
                onChange={(e) => set('height_cm', Number(e.target.value) || 0)}
              />
              <span className="text-sm text-slate-400">cm</span>
            </div>
          )}
        </div>

        {/* Weight */}
        <div>
          <label className="label">Weight</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.1"
              className="input"
              value={imperial ? round1(kgToLb(draft.weight_kg)) : round1(draft.weight_kg)}
              onChange={(e) => {
                const n = Number(e.target.value) || 0
                set('weight_kg', imperial ? lbToKg(n) : n)
              }}
            />
            <span className="text-sm text-slate-400">{imperial ? 'lb' : 'kg'}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Saving also logs today's weight for the trend chart.
          </p>
        </div>

        <Segmented<Units>
          label="Units"
          value={draft.units}
          onChange={(v) => set('units', v)}
          options={[
            { value: 'metric', label: 'Metric' },
            { value: 'imperial', label: 'Imperial' },
          ]}
        />
      </div>

      {/* Activity & goal */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-slate-300">Activity & goal</h2>
        <div>
          <label className="label">Baseline activity (excludes logged workouts)</label>
          <select
            className="input"
            value={draft.activity_level}
            onChange={(e) => set('activity_level', e.target.value as ActivityLevel)}
          >
            {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((k) => (
              <option key={k} value={k}>
                {ACTIVITY_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Goal</label>
          <select
            className="input"
            value={draft.goal_type}
            onChange={(e) => set('goal_type', e.target.value as GoalType)}
          >
            {(Object.keys(GOAL_LABELS) as GoalType[]).map((k) => (
              <option key={k} value={k}>
                {GOAL_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-primary flex-1" onClick={onSave} disabled={busy}>
          {busy ? 'Saving…' : 'Save profile'}
        </button>
        {status && (
          <span
            className={`text-sm ${status.startsWith('Saved') ? 'text-good' : 'text-bad'}`}
          >
            {status}
          </span>
        )}
      </div>

      <button
        className="btn-ghost w-full text-slate-400"
        onClick={() => supabase?.auth.signOut()}
      >
        Sign out {session?.user.email ? `(${session.user.email})` : ''}
      </button>
    </div>
  )
}

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div>
      <div className="text-xl font-bold tabular-nums text-slate-100">{value}</div>
      <div className="text-xs text-slate-500">
        {label}
        {unit ? ` · ${unit}` : ''}
      </div>
    </div>
  )
}

interface SegmentedProps<T extends string> {
  label: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}
function Segmented<T extends string>({ label, value, onChange, options }: SegmentedProps<T>) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex gap-1 rounded-xl border border-base-border p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              value === o.value ? 'bg-accent text-slate-950' : 'text-slate-400'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
