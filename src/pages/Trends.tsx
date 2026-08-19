import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useProfile } from '../hooks/useProfile'
import { useTrends } from '../hooks/useTrends'
import { shortDay } from '../lib/date'
import Spinner from '../components/Spinner'
import BodyComposition from '../components/BodyComposition'

const RANGES = [7, 14, 30] as const

export default function Trends() {
  const { profile } = useProfile()
  const [days, setDays] = useState<(typeof RANGES)[number]>(7)
  const { points, weights, byCategory, loading } = useTrends(days, profile)

  const chartData = useMemo(
    () => points.map((p) => ({ ...p, label: shortDay(p.date) })),
    [points],
  )
  const weightData = useMemo(
    () => weights.map((w) => ({ ...w, label: shortDay(w.date) })),
    [weights],
  )

  const avgNet = points.length
    ? Math.round(points.reduce((s, p) => s + p.net, 0) / points.length)
    : 0
  const avgIntake = points.length
    ? Math.round(points.reduce((s, p) => s + p.intake, 0) / points.length)
    : 0
  const daysLogged = points.filter((p) => p.intake > 0).length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Trends</h1>
        <div className="flex gap-1 rounded-xl border border-base-border p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setDays(r)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                days === r ? 'bg-accent text-slate-950' : 'text-slate-400'
              }`}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Spinner full />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Kpi label="Avg net" value={avgNet > 0 ? `+${avgNet}` : `${avgNet}`} />
            <Kpi label="Avg intake" value={`${avgIntake}`} />
            <Kpi label="Days logged" value={`${daysLogged}/${days}`} />
          </div>

          <ChartCard title="Intake vs. burn">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#fbbf24" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1e2a44" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} interval="preserveStartEnd" />
                <YAxis tick={axisTick} width={44} />
                <Tooltip content={<DarkTooltip />} />
                <Area
                  type="monotone"
                  dataKey="intake"
                  name="In"
                  stroke="#34d399"
                  fill="url(#gIn)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="out"
                  name="Out"
                  stroke="#fbbf24"
                  fill="url(#gOut)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Daily net (surplus / deficit)">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#1e2a44" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} interval="preserveStartEnd" />
                <YAxis tick={axisTick} width={44} />
                <Tooltip content={<DarkTooltip />} cursor={{ fill: '#ffffff08' }} />
                <ReferenceLine y={0} stroke="#475569" />
                <Bar dataKey="net" name="Net" radius={[4, 4, 0, 0]}>
                  {chartData.map((d) => (
                    <Cell key={d.date} fill={d.net > 0 ? '#f87171' : '#34d399'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Macros (grams / day)">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#1e2a44" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} interval="preserveStartEnd" />
                <YAxis tick={axisTick} width={44} />
                <Tooltip content={<DarkTooltip />} cursor={{ fill: '#ffffff08' }} />
                <Bar dataKey="protein" name="Protein" stackId="m" fill="#34d399" />
                <Bar dataKey="carbs" name="Carbs" stackId="m" fill="#38bdf8" />
                <Bar dataKey="fat" name="Fat" stackId="m" fill="#fbbf24" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="By category">
            {byCategory.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No food logged yet.</p>
            ) : (
              <div className="space-y-3">
                {byCategory.map((c) => (
                  <CategoryRow
                    key={c.category}
                    name={c.category}
                    calories={c.calories}
                    max={byCategory[0].calories}
                    protein={c.protein}
                    carbs={c.carbs}
                    fat={c.fat}
                  />
                ))}
              </div>
            )}
          </ChartCard>

          <ChartCard title="Weight">
            {weightData.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                Log your weight on the Profile tab to see the trend.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={weightData} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#1e2a44" vertical={false} />
                  <XAxis dataKey="label" tick={axisTick} interval="preserveStartEnd" />
                  <YAxis tick={axisTick} width={44} domain={['dataMin - 1', 'dataMax + 1']} />
                  <Tooltip content={<DarkTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    name="Weight"
                    stroke="#38bdf8"
                    strokeWidth={1}
                    dot={{ r: 2 }}
                    opacity={0.5}
                  />
                  <Line
                    type="monotone"
                    dataKey="avg"
                    name="7-day avg"
                    stroke="#38bdf8"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <BodyComposition />
        </>
      )}
    </div>
  )
}

const axisTick = { fill: '#64748b', fontSize: 11 }

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h2 className="mb-3 text-sm font-semibold text-slate-300">{title}</h2>
      {children}
    </div>
  )
}

function CategoryRow({
  name,
  calories,
  max,
  protein,
  carbs,
  fat,
}: {
  name: string
  calories: number
  max: number
  protein: number
  carbs: number
  fat: number
}) {
  const width = max > 0 ? (calories / max) * 100 : 0
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="text-slate-200">{name}</span>
        <span className="tabular-nums text-slate-400">{calories} kcal</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-base-border">
        <div className="h-full rounded-full bg-accent" style={{ width: `${width}%` }} />
      </div>
      <div className="mt-1 text-xs text-slate-500">
        {protein}g protein · {carbs}g carbs · {fat}g fat
      </div>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card py-3 text-center">
      <div className="text-lg font-bold tabular-nums text-slate-100">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}

interface TooltipEntry {
  name: string
  value: number
  color: string
}
function DarkTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-base-border bg-base-bg px-3 py-2 text-xs shadow-xl">
      <div className="mb-1 font-semibold text-slate-300">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 tabular-nums">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-400">{p.name}</span>
          <span className="ml-auto font-medium text-slate-100">{Math.round(p.value)}</span>
        </div>
      ))}
    </div>
  )
}
