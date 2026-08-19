# CalTrack — setup

A personal calorie ledger: log food (in) and exercise (out), track macros and
food categories, manage supplements with a "next due" schedule, and watch the
trends. Installs to your phone home screen and desktop as a PWA; data syncs
across devices through your own Supabase project.

CalTrack is **self-configuring and shareable** — the app asks for your Supabase
details in-app, so one deployed copy can serve many people, each pointed at
their own Supabase project and using their own Anthropic key.

## 1. Prerequisites

- Node.js 18+ (`node --version`) if running locally
- A free [Supabase](https://supabase.com) account
- (Optional, for AI food logging) an [Anthropic API key](https://console.anthropic.com)

## 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**.
2. Open **SQL Editor** → **New query**, paste the entire contents of
   [`db/schema.sql`](../db/schema.sql), and **Run**. This creates the tables and
   row-level-security policies so each account only sees its own data. (It's
   idempotent — safe to re-run later when the schema grows.)
3. **Authentication → Providers → Email**: make sure email is enabled
   (passwordless magic-link sign-in).
4. **Authentication → URL Configuration**: add your app's URL(s) to
   **Redirect URLs** (e.g. `http://localhost:5173` and your deployed URL).
5. **Project Settings → API**: keep the **Project URL** and **anon public** key
   handy — you'll paste them into the app.

## 3. Run / open the app

```bash
npm install
npm run dev
```

On first load the app shows a **Connect** screen. Paste your Supabase
**Project URL** and **anon public** key, click Connect, then sign in with your
email. (These are stored locally on the device. You can pre-fill them at build
time instead by copying `.env.example` to `.env`.)

Fill in the **Profile** tab (sex, birthdate, height, weight, activity, goal) —
that drives your baseline burn and daily target. Start logging on **Today**.

## 4. (Optional) AI food logging

Lets you type "two eggs, a banana, and a protein shake" — or paste a nutrition
label — and have Claude fill in calories, protein/carbs/fat, and a category.

1. Install the [Supabase CLI](https://supabase.com/docs/guides/cli) and link
   your project:
   ```bash
   supabase link --project-ref YOUR-PROJECT-REF
   ```
2. Deploy the Edge Functions (food + workout parsing):
   ```bash
   supabase functions deploy parse-food
   supabase functions deploy parse-workout
   ```
3. In the app, go to **Profile → AI food parsing**, paste your Anthropic API
   key, pick a model, and save. The same key powers workout parsing.

Your key is stored in **your own** Supabase `profiles` row (row-level-security
protected) and read only by the `parse-food` function server-side — it never
ships in the browser bundle. The default model is `claude-opus-5`; switch to
`claude-haiku-4-5` for the fastest/cheapest parsing.

## 5. Install as an app

- **Phone:** open the deployed URL in the browser, then "Add to Home Screen."
- **Desktop:** in Chrome/Edge, click the install icon in the address bar.

## 6. Deploy (optional, for cross-device use)

Any static host works (Vercel, Netlify, Cloudflare Pages):

```bash
npm run build   # outputs dist/
```

Build command `npm run build`, output directory `dist`. You don't need to set
env vars — users connect in-app — but you can set `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` to pre-fill a default. Add the deployed URL to
Supabase's redirect URLs (step 2).

## Features

- **Today** — food + exercise ledger with a target ring, In/Out/Net, and a
  macro split. Add food by describing it (AI), pasting a label, or manually.
- **Workouts** — log a session by describing it (Claude structures it into
  exercises + sets and estimates a conservative burn) or by hand. Burn feeds the
  ledger's "Out". Progress tab charts estimated 1RM per lift, weekly volume
  (tonnage), and a personal-record feed. Calorie burn serves the deficit goal;
  the training log serves the getting-stronger goal.
- **Trends** — 7/14/30-day intake vs. burn, daily net, macros/day, calories by
  category, and weight with a 7-day average.
- **Supplements** — define supplements with a dose and cadence (daily, weekly,
  etc.); the app shows what's due, overdue, or on track, and one tap logs a dose.
  Good for a weekly shot, daily creatine, vitamins, and so on.
- **Profile** — TDEE inputs, goal, units, AI key/model, and editable food
  categories.

## How the numbers work

- **Baseline burn** = Mifflin–St Jeor BMR × activity multiplier. Your *baseline*
  activity level reflects daily life **excluding** workouts — those are logged
  separately so they aren't double-counted.
- **Total out** = baseline burn + logged exercise.
- **Net** = food in − total out. Negative = deficit, positive = surplus.
- **Daily target** = baseline burn + your goal delta (e.g. −500 for a cut).
  The "kcal left" ring = target + exercise − food eaten.
