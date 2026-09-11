# Branch → Database mapping

Bloodline Book is **one app**. Git branches choose which backend database to use.

| Git branch | Database | Supabase project | PowerSync instance |
|------------|----------|------------------|-------------------|
| `main`, `master`, `production`, `release/*` | **production** | Prod project | Production instance |
| Everything else (`cursor/*`, `develop`, feature branches) | **development** | Dev project | Development instance |

The app name, bundle ID, and UI are identical on every branch. Only the connected Supabase + PowerSync backend changes.

## Setup (one-time)

Create **two Supabase projects** and **two PowerSync instances** (dev + prod). Run the same migrations in both. See `supabase/README.md`.

## Local development

`scripts/setup-env.sh` detects your current branch and writes `.env`:

```bash
git checkout cursor/my-feature
bash scripts/setup-env.sh   # → development database
npm run web

git checkout main
bash scripts/setup-env.sh   # → production database
npm run web
```

Override manually when needed:

```bash
DATABASE_TARGET=production bash scripts/setup-env.sh
```

## Environment files

```bash
cp .env.development.example .env   # dev database credentials
cp .env.production.example .env    # prod database credentials
```

Or let `setup-env.sh` pick credentials from Cloud Agent secrets based on branch.

## Cloud Agent secrets

Store **both** database credential sets in the same environment:

| Secret | Used on |
|--------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | Feature branches → dev Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Feature branches → dev Supabase |
| `EXPO_PUBLIC_POWERSYNC_URL` | Feature branches → dev PowerSync |
| `EXPO_PUBLIC_SUPABASE_URL_PROD` | `main` / `release/*` → prod Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY_PROD` | `main` / `release/*` → prod Supabase |
| `EXPO_PUBLIC_POWERSYNC_URL_PROD` | `main` / `release/*` → prod PowerSync |

`install` and `start` in `.cursor/environment.json` run `setup-env.sh`, which re-evaluates the branch on every agent boot.

## How to tell which database you're on

Non-production databases show a **Development DB** badge on the dashboard. Production (`main`) shows no badge.

## EAS builds

`eas.json` maps build profiles to database targets:

- `development` / `preview` → development database secrets
- `production` → production database secrets

Store prod credentials as EAS secrets for the `production` profile.

## Vercel (web hosting)

See [vercel-supabase-setup.md](vercel-supabase-setup.md) for the full Vercel + Supabase dev/prod guide. Preview deploys use dev credentials; production (`main`) uses prod credentials.
