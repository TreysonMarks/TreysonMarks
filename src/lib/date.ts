import { format, parseISO } from 'date-fns'

/** Local YYYY-MM-DD for a given Date (defaults to now). */
export function isoDay(d: Date = new Date()): string {
  return format(d, 'yyyy-MM-dd')
}

export function shiftDay(iso: string, days: number): string {
  const d = parseISO(iso)
  d.setDate(d.getDate() + days)
  return isoDay(d)
}

export function prettyDay(iso: string): string {
  const today = isoDay()
  const yesterday = shiftDay(today, -1)
  if (iso === today) return 'Today'
  if (iso === yesterday) return 'Yesterday'
  return format(parseISO(iso), 'EEE, MMM d')
}

export function shortDay(iso: string): string {
  return format(parseISO(iso), 'MMM d')
}
