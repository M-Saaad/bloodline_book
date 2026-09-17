# Bloodline Book

Multi-tenant SaaS for US goat operations — herd records, health, breeding, weight/performance, and finances with offline-capable data entry via PowerSync.

## Phase 0 (complete)

- Expo + TypeScript + NativeWind + Expo Router
- Supabase Auth (email/password) with farm creation flow
- PowerSync local SQLite for `farms`, `farm_members`, `breeds`, `animals`, `weigh_sessions`, `weight_logs`
- Weigh Day batch entry (single local transaction)
- Animal detail/edit, FormMessage on web, loading & empty states

## Phase 1 (current)

- **Finances** — transaction tracking (`transactions` table, migration 0007)
- **More** — settings, team invites, documents, tasks (migrations 0008–0009)
- PowerSync sync rules updated for new tables

## Setup

### 1. Supabase

1. Create a [Supabase](https://supabase.com) project.
2. Run migrations in order from `supabase/migrations/`:
   - `0001_extensions_and_tenancy.sql`
   - `0003_breeds_and_animals.sql`
   - `0004_weight_tracking.sql`
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

## Offline verification (Phase 0 acceptance)

1. Sign up and create a farm.
2. Add at least one animal.
3. Enable airplane mode on the device.
4. Complete a Weigh Day session — data should save locally.
5. Disable airplane mode — data should sync to Supabase (check Table Editor).

## Project structure

See the build specification in the repository issue/PR for the full schema, build order, and Phase 1+ scope.
