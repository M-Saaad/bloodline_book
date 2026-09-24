# Bloodline Book

Multi-tenant SaaS for US goat operations — herd records, health, breeding, weight/performance, and finances with offline-capable data entry via PowerSync.

All build phases, specs, and “Done when” checks live in **[ROADMAP.md](ROADMAP.md)** (phases 0–16). **Current:** Phase 4 complete — **next:** [Phase 5 — Nothing gets lost](ROADMAP.md#phase-5--nothing-gets-lost).

## Setup

### 1. Supabase

1. Create a [Supabase](https://supabase.com) project.
2. Run migrations in order from `supabase/migrations/` (through `0010` on `main`; later phases add `0011+` — see [ROADMAP.md](ROADMAP.md)).
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
npm run web:dev   # or npm run ios:dev / npm run android:dev
```

See [docs/environments.md](docs/environments.md) for branch → database mapping (same app, different Supabase/PowerSync per branch).
