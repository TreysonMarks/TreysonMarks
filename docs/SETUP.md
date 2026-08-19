# CalTrack — setup

A personal calorie ledger: log food (in) and exercise (out), see your net
against a TDEE-based daily target, and watch the trends. Installs to your
phone home screen and desktop as a PWA; data syncs across devices through
Supabase.

## 1. Prerequisites

- Node.js 18+ (`node --version`)
- A free [Supabase](https://supabase.com) account

## 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**. Pick a name
   and a database password (you won't need the password for the app).
2. When it finishes provisioning, open **SQL Editor** → **New query**, paste
   the entire contents of [`db/schema.sql`](../db/schema.sql), and **Run**.
   This creates the tables and row-level-security policies so each account
   only ever sees its own data.
3. Open **Project Settings → API** and copy two values:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon public** key (a long JWT string)

### Email sign-in

The app uses passwordless **magic-link** sign-in. In Supabase go to
**Authentication → Providers → Email** and make sure it's enabled. Under
**Authentication → URL Configuration**, add your app's URLs (e.g.
`http://localhost:5173` for local dev, and your deployed URL) to
**Redirect URLs** so the magic link returns you to the app.

## 3. Configure the app

```bash
cp .env.example .env
```

Edit `.env`:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

## 4. Run it

```bash
npm install
npm run dev
```

Open the printed URL, enter your email, click the magic link, then fill in
the **Profile** tab (sex, birthdate, height, weight, activity, goal). That
drives your baseline burn and daily target. Start logging on **Today**.

## 5. Install as an app

- **Phone:** open the deployed URL in the browser, then "Add to Home Screen."
- **Desktop:** in Chrome/Edge, click the install icon in the address bar.

## 6. Deploy (optional, for cross-device use)

Any static host works. For example, with Vercel or Netlify:

```bash
npm run build   # outputs dist/
```

Point the host at this repo, set the build command to `npm run build`, the
output directory to `dist`, and add the two `VITE_SUPABASE_*` environment
variables in the host's dashboard. Add the deployed URL to Supabase's
redirect URLs (step 2).

## How the numbers work

- **Baseline burn** = Mifflin–St Jeor BMR × activity multiplier. Your
  *baseline* activity level should reflect daily life **excluding** workouts —
  those are logged separately so they aren't double-counted.
- **Total out** = baseline burn + logged exercise.
- **Net** = food in − total out. Negative = deficit, positive = surplus.
- **Daily target** = baseline burn + your goal delta (e.g. −500 for a cut).
  The "kcal left" ring = target + exercise − food eaten.
