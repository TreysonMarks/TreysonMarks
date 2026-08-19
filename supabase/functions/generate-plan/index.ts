// Supabase Edge Function: generate-plan
// Turns a training goal ("general fitness, 4 days/week, full gym") into a
// 7-day weekly template with prescribed exercises per day.
//
// Reads the caller's Anthropic key from THEIR OWN profile via RLS.
// Deploy with: supabase functions deploy generate-plan

import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

interface Req {
  goal?: string
  days_per_week?: number
  equipment?: string
  notes?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

  let body: Req
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) return json({ error: 'Not authenticated' }, 401)

  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('anthropic_key, anthropic_model, units')
    .eq('user_id', user.user.id)
    .maybeSingle()
  if (pErr) return json({ error: pErr.message }, 500)

  const apiKey = profile?.anthropic_key?.trim()
  if (!apiKey) {
    return json({ error: 'No Anthropic API key set. Add one in Profile → AI parsing.' }, 400)
  }

  const weightUnit = profile?.units === 'imperial' ? 'lb' : 'kg'
  const goal = (body.goal ?? 'general fitness').trim()
  const days = Math.min(Math.max(Number(body.days_per_week) || 4, 1), 7)
  const equipment = (body.equipment ?? 'full gym').trim()
  const notes = (body.notes ?? '').trim()

  const system = [
    'You are a strength & conditioning coach. Design a balanced 7-day weekly training template.',
    `Goal: ${goal}. Train ${days} day(s) per week. Equipment: ${equipment}.`,
    notes ? `Extra context: ${notes}.` : '',
    'Cover all 7 weekdays (0 = Sunday, 1 = Monday, ... 6 = Saturday).',
    `Mark non-training days with "is_rest": true and an empty prescription. Distribute the ${days} training days sensibly (avoid stacking hard days back to back).`,
    'For training days, choose a "type" (strength, conditioning, cardio, mixed) and prescribe exercises.',
    `Prescribe weights in ${weightUnit} when giving a number, or null to let the user choose.`,
    'reps may be a string like "8-12", "5", or "AMRAP".',
    'Reply with ONLY a JSON object, no prose, no markdown fences, of the form:',
    '{"days":[{"weekday":0,"is_rest":true,"title":"Rest","type":"mixed","notes":null,"prescription":[]},{"weekday":1,"is_rest":false,"title":"Push","type":"strength","notes":null,"prescription":[{"name":"Bench press","sets":4,"reps":"6-8","weight":null,"notes":null}]}]}',
    'Return exactly one entry per weekday 0-6.',
  ]
    .filter(Boolean)
    .join(' ')

  const anthropic = new Anthropic({ apiKey })
  let raw = ''
  try {
    const model = profile?.anthropic_model || 'claude-opus-5'
    const response = await anthropic.messages.create({
      model,
      max_tokens: 3000,
      output_config: { effort: 'medium' },
      system,
      messages: [{ role: 'user', content: `Design my weekly plan: ${goal}, ${days} days/week.` }],
    })
    for (const block of response.content) if (block.type === 'text') raw += block.text
  } catch (e) {
    return json({ error: `Claude request failed: ${(e as Error).message}` }, 502)
  }

  const parsed = extractJson(raw)
  if (!parsed || !Array.isArray(parsed.days)) {
    return json({ error: 'Could not parse a plan from the response.' }, 502)
  }

  const byWeekday = new Map<number, unknown>()
  for (const d of parsed.days as Record<string, unknown>[]) {
    const wd = Math.max(0, Math.min(6, Math.round(Number(d.weekday))))
    byWeekday.set(wd, {
      weekday: wd,
      is_rest: Boolean(d.is_rest),
      title: String(d.title ?? (d.is_rest ? 'Rest' : 'Training')),
      type: normalizeType(d.type),
      notes: d.notes ? String(d.notes) : null,
      prescription: Array.isArray(d.prescription)
        ? (d.prescription as Record<string, unknown>[]).map((p) => ({
            name: String(p.name ?? ''),
            sets: p.sets == null ? null : Math.round(Number(p.sets)) || null,
            reps: p.reps == null ? null : String(p.reps),
            weight: p.weight == null ? null : Number(p.weight) || null,
            notes: p.notes ? String(p.notes) : null,
          }))
        : [],
    })
  }

  // Ensure all 7 days exist.
  const out = []
  for (let wd = 0; wd < 7; wd++) {
    out.push(
      byWeekday.get(wd) ?? {
        weekday: wd,
        is_rest: true,
        title: 'Rest',
        type: 'mixed',
        notes: null,
        prescription: [],
      },
    )
  }

  return json({ days: out })
})

function normalizeType(v: unknown): string {
  const t = String(v ?? 'mixed').toLowerCase()
  return ['strength', 'conditioning', 'cardio', 'mixed'].includes(t) ? t : 'mixed'
}

function extractJson(raw: string): { days?: unknown[] } | null {
  const fenced = raw.replace(/```json/gi, '').replace(/```/g, '').trim()
  const start = fenced.indexOf('{')
  const end = fenced.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null
  try {
    return JSON.parse(fenced.slice(start, end + 1))
  } catch {
    return null
  }
}
