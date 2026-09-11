# Development vs Production

Bloodline Book uses **two fully separate stacks** — never point dev and prod at the same Supabase project or PowerSync instance.

## What gets duplicated

| Layer | Development | Production |
|-------|-------------|------------|
| **Expo app** | `Bloodline Book (Dev)` · bundle `com.bloodlinebook.dev` | `Bloodline Book` · bundle `com.bloodlinebook.app` |
| **Supabase** | Dev project (run all migrations) | Prod project (run all migrations) |
| **PowerSync** | Development instance | Production instance |
| **Local SQLite** | Separate per install (different bundle ID) | Separate per install |

## 1. Create backend environments

### Supabase

1. Create two projects: e.g. `bloodline-book-dev` and `bloodline-book-prod`.
2. Run the same migrations in **both** (`supabase/migrations/` in order).
3. Set up PowerSync replication role + `powersync` publication in **both**.
4. Keep email confirmation off in dev; configure prod auth as you prefer.

### PowerSync

PowerSync Cloud creates **Development** and **Production** instances by default.

1. Connect **both** instances to their matching Supabase project.
2. Enable **Supabase Auth** on both.
3. Deploy `powersync/sync-rules.yaml` to **both** instances.

## 2. Configure the app

```bash
# Development (default)
cp .env.development.example .env
npm run web:dev

# Production (local smoke test only — use EAS for real prod builds)
cp .env.production.example .env
npm run web:prod
```

### Cloud Agent secrets

**Dev environment** (current):

- `EXPO_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_POWERSYNC_URL`

**Prod environment** (separate Cursor environment recommended):

- `EXPO_PUBLIC_SUPABASE_URL_PROD`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY_PROD`
- `EXPO_PUBLIC_POWERSYNC_URL_PROD`

Set `APP_ENV=production` on the prod Cloud Agent environment.

## 3. Build for stores (EAS)

```bash
# Install EAS CLI and log in
npx eas-cli login

# Dev client (internal testing)
eas build --profile development --platform ios

# Production App Store / Play Store
eas build --profile production --platform all
```

EAS profiles in `eas.json` set `APP_ENV` and `EXPO_PUBLIC_APP_ENV` automatically.

Configure EAS secrets for production builds:

```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://..."
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "..."
eas secret:create --scope project --name EXPO_PUBLIC_POWERSYNC_URL --value "https://..."
```

## 4. How to tell which app you're in

- Dev builds show a **DEV** badge on the dashboard.
- App name on the home screen: **Bloodline Book (Dev)** vs **Bloodline Book**.
- Dev and prod apps can be installed side-by-side on the same phone (different bundle IDs).
