# Demo test account

Use this account to explore Bloodline Book with pre-loaded herd data. Safe for demos and expert review; do not use for real farm records.

## Credentials

### Owner (full access)

| Field | Value |
|-------|--------|
| **Email** | `demo@bloodlinebook.test` |
| **Password** | `DemoHerd2026!` |
| **Farm name** | Willow Creek Demo |

### Hand (view-only — Phase 5)

Same farm as the owner demo. Use this to test read-only UI, sync badge, and rejected uploads (e.g. try to complete a task — should fail on sync and appear under **Changes not saved** after online sync).

| Field | Value |
|-------|--------|
| **Email** | `hand@bloodlinebook.test` |
| **Password** | `DemoHand2026!` |
| **Role** | `hand` on Willow Creek Demo |

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

After sign-in, open **More → Tasks**, **Breeding calendar** (Clover appears when her due date is within 120 days), and **Livestock** for the full herd.

## Refresh or recreate data

From the repo root (uses the anon key in `.env`; run `bash scripts/setup-env.sh` first on Cloud Agent):

```bash
npm run seed:demo
```

If a farm named `Willow Creek Demo` already exists for this user, the script leaves herd data unchanged but still ensures the **hand** member exists on that farm.

## Backend

Data lives in the Supabase project configured in `.env` (`EXPO_PUBLIC_SUPABASE_URL`). PowerSync must have sync rules deployed so the app pulls these tables after login. If tables are missing, run migrations in `supabase/migrations/` on that project first.
