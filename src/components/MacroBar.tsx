interface Props {
  protein: number
  carbs: number
  fat: number
}

// Calorie contribution per gram, used to size the split bar by energy share.
const KCAL = { protein: 4, carbs: 4, fat: 9 }

const COLORS = { protein: '#34d399', carbs: '#38bdf8', fat: '#fbbf24' }

export default function MacroBar({ protein, carbs, fat }: Props) {
  const cals = {
    protein: protein * KCAL.protein,
    carbs: carbs * KCAL.carbs,
    fat: fat * KCAL.fat,
  }
  const total = cals.protein + cals.carbs + cals.fat
  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0)

  return (
    <div className="w-full">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-base-border">
        <span style={{ width: `${pct(cals.protein)}%`, background: COLORS.protein }} />
        <span style={{ width: `${pct(cals.carbs)}%`, background: COLORS.carbs }} />
        <span style={{ width: `${pct(cals.fat)}%`, background: COLORS.fat }} />
      </div>
      <div className="mt-2 grid grid-cols-3 text-center text-xs">
        <Macro label="Protein" grams={protein} color={COLORS.protein} />
        <Macro label="Carbs" grams={carbs} color={COLORS.carbs} />
        <Macro label="Fat" grams={fat} color={COLORS.fat} />
      </div>
    </div>
  )
}

function Macro({ label, grams, color }: { label: string; grams: number; color: string }) {
  return (
    <div>
      <div className="font-semibold tabular-nums" style={{ color }}>
        {grams}g
      </div>
      <div className="text-slate-500">{label}</div>
    </div>
  )
}
