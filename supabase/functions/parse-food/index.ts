// Supabase Edge Function: parse-food
// Turns a free-text meal description (or a pasted nutrition label) into
// structured food items with calories + macros + a category, using Claude.
//
// The caller's Anthropic API key is read from THEIR OWN profile row via RLS
// (using the caller's JWT), so the key never lives in the browser bundle and
// every user brings their own. Deploy with:
//   supabase functions deploy parse-food
//
// This function needs no Supabase secrets — SUPABASE_URL and SUPABASE_ANON_KEY
// are injected automatically. The Anthropic key comes from the user's profile.

import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

interface ParseRequest {
  text: string
  categories?: string[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

  let payload: ParseRequest
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const text = (payload.text ?? '').trim()
  if (!text) return json({ error: 'Nothing to parse' }, 400)

  // Read the caller's profile (RLS scopes it to their own row via the JWT).
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) return json({ error: 'Not authenticated' }, 401)

  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('anthropic_key, anthropic_model')
    .eq('user_id', user.user.id)
    .maybeSingle()

  if (pErr) return json({ error: pErr.message }, 500)
  const apiKey = profile?.anthropic_key?.trim()
  if (!apiKey) {
    return json(
      { error: 'No Anthropic API key set. Add one in Profile → AI parsing.' },
      400,
    )
  }

  const categories = (payload.categories ?? []).filter(Boolean)
  const categoryLine = categories.length
    ? `Choose "category" from exactly this list (pick the closest fit): ${categories.join(', ')}.`
    : 'Assign a short, sensible "category" for each item.'

  const system = [
    'You convert a description of food and drink into structured nutrition data.',
    'Estimate calories and macronutrients from typical values when exact facts are not given.',
    'If a nutrition label is pasted, use its numbers, scaled by any stated quantity.',
    categoryLine,
    'Reply with ONLY a JSON object, no prose, no markdown fences, of the form:',
    '{"items":[{"name":string,"calories":number,"protein_g":number,"carbs_g":number,"fat_g":number,"category":string,"quantity":number}]}',
    'Group naturally: itemize distinct foods, but keep a single dish as one item.',
    'quantity is servings (default 1); calories and macros are PER SERVING.',
    'All numbers are non-negative. Round calories to whole numbers, macros to one decimal.',
  ].join(' ')

  const anthropic = new Anthropic({ apiKey })

  let raw = ''
  try {
    const model = profile?.anthropic_model || 'claude-opus-5'
    const response = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      output_config: { effort: 'low' },
      system,
      messages: [{ role: 'user', content: text }],
    })
    for (const block of response.content) {
      if (block.type === 'text') raw += block.text
    }
  } catch (e) {
    return json({ error: `Claude request failed: ${(e as Error).message}` }, 502)
  }

  const parsed = extractJson(raw)
  if (!parsed || !Array.isArray(parsed.items)) {
    return json({ error: 'Could not parse a food list from the response.' }, 502)
  }

  const items = parsed.items.map((it: Record<string, unknown>) => ({
    name: String(it.name ?? 'Food'),
    calories: num(it.calories),
    protein_g: num(it.protein_g),
    carbs_g: num(it.carbs_g),
    fat_g: num(it.fat_g),
    category: String(it.category ?? 'Other'),
    quantity: num(it.quantity) || 1,
  }))

  return json({ items })
})

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) && n >= 0 ? n : 0
}

// Pull the first JSON object out of the response, tolerating stray prose or fences.
function extractJson(raw: string): { items?: unknown[] } | null {
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
