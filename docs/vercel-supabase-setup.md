# Vercel + Supabase: Dev & Prod Setup

One app, two backends. **Vercel preview deployments** use the dev database; **Vercel production** (from `main`) uses the prod database.

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Git branch     │────▶│  Vercel deploy   │────▶│  Supabase DB    │
├─────────────────┤     ├──────────────────┤     ├─────────────────┤
│  feature/cursor │     │  Preview         │     │  Dev project    │
│  develop        │     │  Preview         │     │  Dev project    │
│  main           │     │  Production      │     │  Prod project   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## Part 1 — Supabase (do this first)

### Step 1: Create two projects

In [supabase.com/dashboard](https://supabase.com/dashboard):

| Project | Purpose | Suggested name |
|---------|---------|----------------|
| **Dev** | Feature branches, Vercel previews | `bloodline-book-dev` |
| **Prod** | `main` branch, live users | `bloodline-book-prod` |

### Step 2: Run migrations on both

In each project's **SQL Editor**, run in order:

1. `supabase/migrations/0001_extensions_and_tenancy.sql`
2. `supabase/migrations/0003_breeds_and_animals.sql`
3. `supabase/migrations/0004_weight_tracking.sql`

Then run the PowerSync replication SQL from `supabase/README.md` on **both** projects.

### Step 3: Note your credentials

For each project, go to **Settings → API** and copy:

- **Project URL** → `https://xxxxx.supabase.co`
- **anon / publishable key** → `eyJ...` or `sb_publishable_...`

### Step 4: Configure Auth redirect URLs

Authentication → **URL Configuration**:

**Dev project** — add:

```
http://localhost:8081/**
https://*.vercel.app/**
```

**Prod project** — add:

```
https://your-production-domain.com/**
https://bloodline-book.vercel.app/**
```

Replace with your actual Vercel production URL or custom domain.

**Password reset (Phase 5):** add these redirect URLs on **both** dev and prod Supabase projects so “Forgot password?” can open the app:

```
bloodlinebook://reset-password
http://localhost:8081/reset-password
https://*.vercel.app/reset-password
```

For production, also add your stable site URL, for example `https://bloodline-book.vercel.app/reset-password`.

**Dev tip:** disable email confirmation on the dev project (Authentication → Providers → Email).

### Step 5: PowerSync (both projects)

For each Supabase project, connect a matching PowerSync instance:

1. Create/link PowerSync instance → connect to that Supabase project
2. Enable **Supabase Auth** in PowerSync Client Auth
3. Deploy `powersync/sync-rules.yaml`

You'll get two PowerSync URLs — one for dev, one for prod.

---

## Part 2 — Vercel

### Step 1: Import the repo

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import `M-Saaad/bloodline_book` from GitHub
3. Vercel reads `vercel.json` automatically — no framework preset needed

### Step 2: Set environment variables

In Vercel → your project → **Settings → Environment Variables**, add:

| Variable | Preview | Production | Value |
|----------|---------|------------|-------|
| `EXPO_PUBLIC_SUPABASE_URL` | ✅ | ✅ | Dev URL in **Preview**, Prod URL in **Production** |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | Dev key in **Preview**, Prod key in **Production** |
| `EXPO_PUBLIC_POWERSYNC_URL` | ✅ | ✅ | Dev PowerSync in **Preview**, Prod in **Production** |
| `EXPO_PUBLIC_DATABASE_TARGET` | ✅ | ✅ | `development` in **Preview**, `production` in **Production** |

**Migrating from the old Next.js app:** if your Vercel project still has `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, the Expo build script maps those automatically — but you must still add `EXPO_PUBLIC_POWERSYNC_URL` (required for the Phase 0 foundation in [ROADMAP.md](../ROADMAP.md)).

Use the **same variable names** — Vercel injects different values per deployment type.

Example:

```
Preview scope:
  EXPO_PUBLIC_SUPABASE_URL     = https://dev-ref.supabase.co
  EXPO_PUBLIC_SUPABASE_ANON_KEY = eyJ...dev...
  EXPO_PUBLIC_POWERSYNC_URL    = https://dev.powersync.journeyapps.com
  EXPO_PUBLIC_DATABASE_TARGET  = development

Production scope (main branch only):
  EXPO_PUBLIC_SUPABASE_URL     = https://prod-ref.supabase.co
  EXPO_PUBLIC_SUPABASE_ANON_KEY = eyJ...prod...
  EXPO_PUBLIC_POWERSYNC_URL    = https://prod.powersync.journeyapps.com
  EXPO_PUBLIC_DATABASE_TARGET  = production
```

### Step 3: Production branch

Settings → **Git** → Production Branch = `main`

### Step 4: Deploy

```bash
# First deploy (or push to GitHub — Vercel auto-deploys)
git push origin main          # → Production deploy → prod Supabase
git push origin cursor/...    # → Preview deploy → dev Supabase
```

Or locally:

```bash
npm i -g vercel
vercel          # preview deploy
vercel --prod   # production deploy
```

### Step 5: Verify

| Check | Preview URL | Production URL |
|-------|-------------|----------------|
| App loads | ✅ | ✅ |
| Dashboard shows **Development DB** badge | ✅ | ❌ (no badge) |
| Sign up creates row in correct Supabase | Dev Table Editor | Prod Table Editor |

---

## Part 3 — Day-to-day workflow

```
1. Work on feature branch locally
   → npm run web (uses dev Supabase via setup-env.sh)

2. Push branch / open PR
   → Vercel Preview URL (dev Supabase)

3. Merge to main
   → Vercel Production URL (prod Supabase)
   → Run any new migrations on prod Supabase first!
```

### Migration checklist before merging to main

When you add new SQL migrations:

1. Run migration on **dev** Supabase → test on preview deploy
2. Run same migration on **prod** Supabase
3. Redeploy PowerSync sync rules if new tables were added
4. Merge to `main`

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Blank page on Vercel | Check build logs; ensure `dist/` is output. Do **not** add SPA rewrite to `/` — we use static export. |
| Auth redirect error | Add your Vercel URL to Supabase Auth → URL Configuration |
| Data goes to wrong database | Check Vercel env var **scope** (Preview vs Production) |
| PowerSync won't connect | Confirm PowerSync URL matches the Supabase project for that environment |
| Build fails on worker | `scripts/vercel-build.sh` copies PowerSync assets — check build log |

---

## Optional: custom domain

1. Vercel → Settings → Domains → add `app.bloodlinebook.com`
2. Add `https://app.bloodlinebook.com/**` to **prod** Supabase Auth redirect URLs
3. Production deploys will serve on your domain automatically
