export default function Spinner({ full = false }: { full?: boolean }) {
  const spinner = (
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-accent" />
  )
  if (!full) return spinner
  return <div className="flex h-full min-h-[60vh] items-center justify-center">{spinner}</div>
}
