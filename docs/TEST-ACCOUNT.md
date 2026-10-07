# Demo test account

Use this account to explore Bloodline Book with pre-loaded herd data. Safe for demos and expert review; do not use for real farm records.

## Credentials

| Field | Value |
|-------|--------|
| **Email** | `demo@bloodlinebook.test` |
| **Password** | In the repo owner’s password manager (not in git) |
| **Farm name** | Willow Creek Demo |

The email and password are **not** stored in git, `.env`, or any `EXPO_PUBLIC_*` variable. The owner keeps them in a password manager and exports them in the shell as `DEMO_EMAIL` and `DEMO_PASSWORD` when seeding or signing in for a demo.

Sign in with email and password (no magic link). Email confirmation is disabled on dev Supabase projects.

## What is in the farm

- **Animals (5 active):** Daisy and Clover (does), Atlas (buck), Daisy kid 1 & 2 (kids from a past kidding)
- **Breeding:** Clover bred ~30 days ago (due in ~150 days); Daisy’s prior breeding marked kidded and linked to the litter
- **Health:** FAMACHA 3 on Daisy, FAMACHA 4 on Clover (recheck task), CD&T vaccination, deworming with withdrawal
- **Land:** North Paddock (4 acres, grazing); Daisy and Clover moved in ~7 days ago; hay feed log
- **Weights:** Recent ad hoc weigh session for Daisy, Clover, and one kid
- **Finances:** Feed expense and animal sale revenue
- **Tasks:** Expected kidding, FAMACHA recheck, manual chore (one completed)
- **Documents:** ADGA registration metadata (no file attached)

After sign-in, open **Today**, **More → Tasks** (Open / Done), **Breeding calendar** (every bred or confirmed doe, including Clover), and **Livestock** for the full herd.

## Refresh or recreate data

From the repo root (uses the anon key in `.env`; run `bash scripts/setup-env.sh` first on Cloud Agent). The script prints the Supabase project URL and refuses to write unless `--yes-live` is passed.

```bash
export DEMO_EMAIL='demo@bloodlinebook.test'
export DEMO_PASSWORD='…from password manager…'
npm run seed:demo -- --yes-live
```

If a farm named `Willow Creek Demo` already exists for this user, the script leaves it unchanged.

To delete that farm’s rows and seed it again, pass `--reset`. Without `--yes`, the script only prints what it would do (dry run; no database changes). With `--yes-live --reset --yes`, it signs in as the demo user and only deletes the farm named `Willow Creek Demo` that this user owns. `farms` has no DELETE policy, so the anon key cannot remove the farm row itself. If that happens, the script stops, lists what is left, and prints SQL to run in the Supabase SQL editor. It does not seed a second copy while the old farm row remains.

Dry run (safe; does not connect for writes):

```bash
export DEMO_EMAIL='demo@bloodlinebook.test'
export DEMO_PASSWORD='…from password manager…'
npm run seed:demo -- --reset
```

Reset and re-seed on the live project:

```bash
export DEMO_EMAIL='demo@bloodlinebook.test'
export DEMO_PASSWORD='…from password manager…'
npm run seed:demo -- --yes-live --reset --yes
```

## Backend

Data lives in the Supabase project configured in `.env` (`EXPO_PUBLIC_SUPABASE_URL`). PowerSync must have sync rules deployed so the app pulls these tables after login. If tables are missing, run migrations in `supabase/migrations/` on that project first.
