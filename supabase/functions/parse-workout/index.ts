// Supabase Edge Function: parse-workout
// Turns a free-text training session ("5x5 squat at 225, then a 15-min AMRAP")
// into a structured workout: title, type, per-exercise sets, and a DELIBERATELY
// CONSERVATIVE calorie-burn estimate (so it doesn't inflate the eating budget).
//
// Reads the caller's Anthropic key + bodyweight from THEIR OWN profile via RLS.
// Deploy with: supabase functions deploy parse-workout

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

  let text = ''
  try {
    text = (((await req.json()) as { text?: string }).text ?? '').trim()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  if (!text) return json({ error: 'Nothing to parse' }, 400)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) return json({ error: 'Not authenticated' }, 401)

  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('anthropic_key, anthropic_model, weight_kg, units')
    .eq('user_id', user.user.id)
    .maybeSingle()

  if (pErr) return json({ error: pErr.message }, 500)
  const apiKey = profile?.anthropic_key?.trim()
  if (!apiKey) {
    return json({ error: 'No Anthropic API key set. Add one in Profile → AI parsing.' }, 400)
  }

  const units = profile?.units === 'imperial' ? 'imperial' : 'metric'
  const weightUnit = units === 'imperial' ? 'lb' : 'kg'
  const bodyweightKg = Number(profile?.weight_kg ?? 75)
  const bodyweightDisplay =
    units === 'imperial' ? Math.round(bodyweightKg / 0.45359237) : Math.round(bodyweightKg)

  const system = [
    'You convert a description of a workout into structured training data.',
    `The user weighs about ${bodyweightDisplay} ${weightUnit}. Interpret lifted weights in ${weightUnit}.`,
    'Classify "type" as one of: strength, conditioning, cardio, mixed.',
    'For each exercise: if it is a lift, fill "sets" as [{"reps":n,"weight":w}] (one object per set; expand "5x5 @ 225" into five identical sets).',
    'For running/rowing/cycling, set "distance_m" and/or "duration_sec" and leave sets empty.',
    'For metcons/AMRAPs/circuits, put the result in "score" (e.g. "12 rounds") and leave sets empty.',
    'Estimate "calories_burned" for the whole session CONSERVATIVELY — err low.',
    'Guideline: strength ~3-5 kcal/kg/hr, conditioning ~8-10, easy cardio ~6-8, hard cardio ~10-12,',
    `scaled by the user's bodyweight and the session duration. Round to a whole number.`,
    'Also estimate "duration_min" if not stated.',
    'Reply with ONLY a JSON object, no prose, no markdown fences, of the form:',
    '{"title":string,"type":string,"calories_burned":number,"duration_min":number,"notes":string,"exercises":[{"name":string,"sets":[{"reps":number,"weight":number}],"distance_m":number,"duration_sec":number,"score":string}]}',
    'Use null for fields that do not apply. All numbers non-negative.',
  ].join(' ')

  const anthropic = new Anthropic({ apiKey })
  let raw = ''
  try {
    const model = profile?.anthropic_model || 'claude-opus-5'
    const response = await anthropic.messages.create({
      model,
      max_tokens: 1500,
      output_config: { effort: 'low' },
      system,
      messages: [{ role: 'user', content: text }],
    })
    for (const block of response.content) if (block.type === 'text') raw += block.text
  } catch (e) {
    return json({ error: `Claude request failed: ${(e as Error).message}` }, 502)
  }

  const parsed = extractJson(raw)
  if (!parsed) return json({ error: 'Could not parse a workout from the response.' }, 502)

  const exercises = Array.isArray(parsed.exercises) ? parsed.exercises : []
  const result = {
    title: String(parsed.title ?? 'Workout'),
    type: normalizeType(parsed.type),
    calories_burned: num(parsed.calories_burned),
    duration_min: parsed.duration_min == null ? null : num(parsed.duration_min),
    notes: parsed.notes ? String(parsed.notes) : null,
    exercises: exercises.map((ex: Record<string, unknown>) => ({
      name: String(ex.name ?? 'Exercise'),
      sets: Array.isArray(ex.sets)
        ? (ex.sets as Record<string, unknown>[]).map((s) => ({
            reps: num(s.reps),
            weight: num(s.weight),
          }))
        : [],
      distance_m: ex.distance_m == null ? null : num(ex.distance_m),
      duration_sec: ex.duration_sec == null ? null : num(ex.duration_sec),
      score: ex.score ? String(ex.score) : null,
    })),
  }

  return json(result)
})

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function normalizeType(v: unknown): string {
  const t = String(v ?? 'mixed').toLowerCase()
  return ['strength', 'conditioning', 'cardio', 'mixed'].includes(t) ? t : 'mixed'
}

function extractJson(raw: string): Record<string, unknown> | null {
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
