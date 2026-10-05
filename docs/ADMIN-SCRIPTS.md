# Admin scripts

These scripts are for **operators only**. They use secrets that must never ship in the mobile or web app.

## Security

- **`SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security.** Keep it out of the repo, out of `.env` files used by Expo, and out of every `EXPO_PUBLIC_*` variable.
- Export credentials in your shell for the single command, then unset them or close the terminal.

## Password recovery link (`scripts/admin-recovery-link.mjs`)

**When to use it:** A farmer forgot their password and Supabase’s built-in recovery email only reaches your team inbox (or you need to paste a link into your own channel — SMS, WhatsApp, support ticket).

The script does **not** send email. It prints one **action link** you can copy and send securely.

### Run

```bash
export SUPABASE_URL='https://YOUR_PROJECT.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'
node scripts/admin-recovery-link.mjs farmer@example.com
```

The script prints the project URL, asks you to type `yes`, then prints the recovery link (nothing else from the API response).

If there is no auth user with that email, it exits with: `No Supabase Auth user exists for: …`

### Redirect URL

After the farmer opens the link, Supabase redirects them to your app’s reset screen. That target must be allowed in the Supabase dashboard:

**Authentication → URL Configuration → Redirect URLs**

Bloodline Book expects paths like:

- `bloodlinebook://reset-password` (native)
- `http://localhost:8081/reset-password` (local web)
- `https://bloodline-book.vercel.app/reset-password` (production web)

See also [vercel-supabase-setup.md](vercel-supabase-setup.md).

**How to see which redirect a link uses:** The printed `action_link` is a Supabase verify URL. Decode the `redirect_to` query parameter (URL-encoded), for example:

```bash
node -e "const u=new URL(process.argv[1]); console.log(u.searchParams.get('redirect_to'))" 'PASTE_ACTION_LINK_HERE'
```

If `redirect_to` is missing or wrong, set **Site URL** / **Redirect URLs** in Supabase Auth settings, or pass a redirect when generating links (future script option). The app’s in-app “Forgot password?” flow uses `Linking.createURL('/reset-password')` — match that pattern in Auth settings for each environment.

### Farmer flow

1. Open the link on the device where they use Bloodline Book.
2. Land on **Reset password** (`app/(auth)/reset-password.tsx`).
3. Enter a new password (same rules as sign-up: at least 8 characters).

## Farm CSV export (`scripts/export-farm-csv.mjs`)

**When to use it:** A farmer asks for a copy of their herd records, and there is no in-app export button yet. This is how you honour that request.

The script writes one CSV per farm-scoped table under `exports/<farm-slug>-<YYYY-MM-DD>/`. Foreign-key ids stay in their original columns. Where it is straightforward, a readable name (and tag, for goats) is added in the next column — for example `animal_id` plus `animal_name` and `animal_tag`.

It does **not** export `farm_members` or `farm_invites`. Those tables hold other people’s email addresses.

`exports/` is gitignored. Do not commit the files. Send them to the farmer through a channel you already use for support, then delete the folder from this machine.

### Run

```bash
export SUPABASE_URL='https://YOUR_PROJECT.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'
node scripts/export-farm-csv.mjs "Willow Creek"
```

You can pass a farm id instead of a name. The script prints the project URL and waits for `yes` before it reads any rows. If several farms share the name, it lists their ids and stops.

## Database backup (`scripts/backup-db.sh`)

**When to use it:** Once a week, from your own machine, so a bad migration or a deleted project is recoverable. The dump contains the whole database, including farmer records and auth data. Keep it outside this repo.

This repository is public. Do **not** add a GitHub Actions workflow for backups. Artifacts from a public repo can be downloaded by other GitHub users.

The script reads `SUPABASE_DB_URL` (the Postgres connection string) and `BACKUP_DIR` from the shell only. It does not read `.env`. It refuses to run if `BACKUP_DIR` is inside the git checkout. It writes:

- `bloodline-schema-<timestamp>.sql`
- `bloodline-data-<timestamp>.sql`

It uses `supabase db dump` when the Supabase CLI is installed, and `pg_dump` otherwise. Each file starts with a `psql` restore comment. After a successful dump it keeps the newest 8 schema files and the newest 8 data files, and prints their sizes in bytes.

Get the connection string from the Supabase dashboard: **Connect** → direct connection (or the session pooler URI). It looks like `postgresql://postgres.<ref>:<password>@<host>:5432/postgres`. Store it in a file outside the repo, mode `600`, not in git.

### Weekly run

```bash
set -a
# shellcheck disable=SC1090
source "$HOME/.config/bloodline/db-url.env"
set +a
export BACKUP_DIR="$HOME/bloodline-backups"
bash /path/to/bloodline_book/scripts/backup-db.sh
```

`$HOME/.config/bloodline/db-url.env` should contain only `SUPABASE_DB_URL='postgresql://...'`.

A Sunday cron entry on that machine (not in GitHub):

```cron
15 6 * * 0 bash -lc 'set -a; source "$HOME/.config/bloodline/db-url.env"; set +a; export BACKUP_DIR="$HOME/bloodline-backups"; bash "$HOME/src/bloodline_book/scripts/backup-db.sh"'
```

### Test a restore

1. Create a new empty Supabase project used only as a scratch target. Do not use the farmer project.
2. Copy that project's direct connection string.
3. From the backup directory, schema first, then the matching data file:

```bash
export SUPABASE_DB_URL='postgresql://...scratch-project...'
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f bloodline-schema-TIMESTAMP.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f bloodline-data-TIMESTAMP.sql
```

4. In the scratch project's SQL editor, check a table you know (for example `select count(*) from public.farms`).
5. Delete the scratch project when the check is done.

The same `psql` lines are in a comment at the top of each dump. Point them at the scratch URL only.
