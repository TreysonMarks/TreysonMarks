interface Props {
  /** 0..1+ fraction of target consumed. */
  fraction: number
  label: string
  sublabel: string
  over?: boolean
}

export default function ProgressRing({ fraction, label, sublabel, over }: Props) {
  const size = 168
  const stroke = 14
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(fraction, 1))
  const dash = circ * clamped
  const color = over ? '#f87171' : fraction > 0.85 ? '#fbbf24' : '#34d399'

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#1e2a44" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-extrabold tabular-nums" style={{ color }}>
          {label}
        </span>
        <span className="mt-0.5 text-xs text-slate-400">{sublabel}</span>
      </div>
    </div>
  )
}
