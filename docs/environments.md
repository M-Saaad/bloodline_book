# Branch → Database mapping

Bloodline Book is **one app**. Git branches choose which backend database to use.

| Git branch | Database | Supabase project | PowerSync instance |
|------------|----------|------------------|-------------------|
| `main`, `master`, `production`, `release/*` | **production** | Prod project | Production instance |
| Everything else (`cursor/*`, `develop`, feature branches) | **development** | Dev project | Development instance |

The app name, bundle ID, and UI are identical on every branch. Only the connected Supabase + PowerSync backend changes.

## Setup (one-time)

Create **two Supabase projects** and **two PowerSync instances** (dev + prod). Run the same migrations in both, through `0016_dam_external_name.sql`. See `supabase/README.md`.

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

## Pilot builds

The `pilot` profile builds an installable Android APK for pilot farmers. It sets `distribution` to `internal`, `android.buildType` to `apk`, and the same database target as `production`: `DATABASE_TARGET` and `EXPO_PUBLIC_DATABASE_TARGET` are `production`. It also sets `environment` to `production`. EAS CLI 16 and later (this repo requires `>= 16.0.0`) accepts that key, so the build reads variables from the EAS production environment. An internal profile that omits `environment` loads the preview environment instead.

`app.config.ts` does not define the Supabase URL, the anon key, or the PowerSync URL. `.env.production.example` names the variables a production build reads. `scripts/setup-env.sh` only writes a local `.env` for the current shell; EAS Build does not run it, so the `_PROD` and `NEXT_PUBLIC_*` aliases that script accepts are not what the APK reads. Create these names in the EAS production environment. Do not commit values, and do not put them in `eas.json`. Use plain text or sensitive visibility so Expo can inline them; secret visibility is not substituted into `EXPO_PUBLIC_*` client code.

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_POWERSYNC_URL`

`EXPO_PUBLIC_DATABASE_TARGET` is already set on the `pilot` profile.

```bash
eas env:create production
eas build -p android --profile pilot
```

Run `eas env:create production` once for each name above. Never use `preview` for farmers because it talks to the development setup.

## Vercel (web hosting)

See [vercel-supabase-setup.md](vercel-supabase-setup.md) for the full Vercel + Supabase dev/prod guide. Preview deploys use dev credentials; production (`main`) uses prod credentials.
