# Bloodline Book

Multi-tenant SaaS for US goat operations — herd records, health, breeding, weight/performance, and finances with offline-capable data entry via PowerSync.

## Phase 0 (complete)

- Expo + TypeScript + NativeWind + Expo Router
- Supabase Auth (email/password) with farm creation flow
- PowerSync local SQLite for `farms`, `farm_members`, `breeds`, `animals`, `weigh_sessions`, `weight_logs`
- Weigh Day batch entry (single local transaction)
- Animal detail/edit, FormMessage on web, loading & empty states

## Phase 1 (complete)

- **Finances** — transaction tracking (`transactions` table, migration 0007)
- **More** — settings, team invites, documents, tasks (migrations 0008–0009)
- PowerSync sync rules updated for new tables

## Phase 2 (complete)

- Health records and breeding/kidding (migrations 0005–0006)
- Kidding kid records, health-driven tasks, breeding calendar

## Phase 3 (complete)

- **Land** — pastures, grazing occupancy, and feed logs (migration 0010)

## Phase 4 (current)

- **Breeding follow-ups** — kidding links open breedings, optional kid registration (`litter_id`), breeding calendar, due-date tasks
- **Health follow-ups** — FAMACHA 4–5 and withdrawal tasks; health timeline on animal detail
- **Web SQL** — portable `ORDER BY` (no `NULLS LAST`) for PowerSync web SQLite

## Setup

### 1. Supabase

1. Create a [Supabase](https://supabase.com) project.
2. Run migrations in order from `supabase/migrations/`:
   - `0001_extensions_and_tenancy.sql`
   - `0003_breeds_and_animals.sql`
   - `0004_weight_tracking.sql`
   - `0005_breeding_and_kidding.sql`
   - `0006_health_records.sql`
   - `0007_finances.sql`
   - `0008_farm_invites.sql`
   - `0009_documents_and_tasks.sql`
   - `0010_pastures_and_feed.sql`
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
