/** Minimal CSV parser: handles quoted fields, escaped quotes, and commas/newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += c
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  // Drop fully-empty trailing rows.
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

/** Best-effort normalize a date cell to YYYY-MM-DD; null if unparseable. */
export function normalizeDate(raw: string): string | null {
  const v = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  const d = new Date(v)
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  return null
}

/** Parse a numeric cell, stripping stray units/commas. */
export function parseNum(raw: string): number {
  const n = parseFloat(String(raw).replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** Guess which column index matches a field, by header keywords. */
export function guessColumn(headers: string[], keywords: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().trim())
  for (const kw of keywords) {
    const idx = lower.findIndex((h) => h.includes(kw))
    if (idx !== -1) return idx
  }
  return -1
}
