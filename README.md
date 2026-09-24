# Bloodline Book

Multi-tenant SaaS for US goat operations — herd records, health, breeding, weight/performance, and finances with offline-capable data entry via PowerSync.

All build phases, specs, and “Done when” checks live in **[ROADMAP.md](ROADMAP.md)** (phases 0–16). **Current:** Phase 6 complete — **next:** [Phase 7 — Know every goat](ROADMAP.md#phase-7--know-every-goat-q5).

## Setup

### 1. Supabase

1. Create a [Supabase](https://supabase.com) project.
2. Run migrations in order from `supabase/migrations/` (through `0011` on `main`; later phases add `0012+` — see [ROADMAP.md](ROADMAP.md)).
3. Create a PowerSync replication role and publication (see [PowerSync + Supabase guide](https://docs.powersync.com/integration-guides/supabase-+-powersync)).
4. Disable email confirmation for local dev (Authentication → Providers → Email).

### 2. PowerSync

1. Create a [PowerSync Cloud](https://powersync.com) instance connected to your Supabase database.
2. Enable **Supabase Auth** in Client Auth settings.
3. Deploy sync rules from `powersync/sync-rules.yaml`.

### 3. App environment

```bash
cp .env.development.example .env   # or .env.production.example for prod
npm install
npm run web   # or npm run ios / npm run android
```

See [docs/environments.md](docs/environments.md) for branch → database mapping (same app, different Supabase/PowerSync per branch).

## Product review

User-facing inventory of what the app does today, what it does not, and questions for an outside expert: [docs/PRODUCT-REVIEW.md](docs/PRODUCT-REVIEW.md).

Every path from sign-in through FAMACHA scoring and kidding, including branches and chained stories: [docs/USER-FLOWS.md](docs/USER-FLOWS.md).

Demo login with sample herd data: [docs/TEST-ACCOUNT.md](docs/TEST-ACCOUNT.md) (`npm run seed:demo`).
