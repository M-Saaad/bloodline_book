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

**When to run it:** from your own machine, once a week, and again before every migration, before you delete data, and before the isolation test (`npm run test:isolation`). The dump contains farmer records, emails, and password hashes. Keep it outside this repo.

This repository is public. Do **not** add a GitHub Actions workflow for backups. Artifacts from a public repo can be downloaded by other GitHub users.

The script reads `SUPABASE_DB_URL` and `BACKUP_DIR` from the shell only. It does not read `.env` or anything checked into the repo. It refuses to run if `BACKUP_DIR` is inside the git checkout, including when a symlink makes that path land inside the repo or the path you named is a symlink inside the repo. It never prints the connection string. It prints the database host only.

It uses `pg_dump` and `psql` only. It does not call the Supabase CLI and it does not need Docker. Before dumping, it runs `psql "$SUPABASE_DB_URL" -Atc 'show server_version'` and exits if `pg_dump` is older than the server. If `pg_dump` or `psql` is missing, the script prints how to install the PostgreSQL client tools on Windows, macOS, and Linux.

One run writes three files that share a timestamp:

- `bloodline-schema-<timestamp>.sql` — `public` schema
- `bloodline-auth-<timestamp>.sql` — `auth.users` and `auth.identities`
- `bloodline-data-<timestamp>.sql` — `public` table data

The auth and public data files begin with `SET session_replication_role = replica;` so a restore does not fire `handle_new_farm` or `accept_farm_invites_for_user`. Those triggers insert into `farm_members` and break foreign keys. Every file includes a header comment with the restore order and commands: schema, then auth data, then public data. After a successful dump the script keeps the newest 8 sets. The three files from one run are always kept or removed together. It prints each file's size in bytes and how many `COPY` blocks it contains, and it sets mode `600` where the system allows it.

The auth file contains emails and password hashes. Keep it private. Do not commit it, and do not email it.

Do not put `BACKUP_DIR` in OneDrive, Dropbox, or any other synced folder unless that folder is encrypted. Sync clients copy the files onto other machines and into the cloud.

### Connection string

In the Supabase dashboard open **Connect** and copy the **Session pooler** URI. Use port **5432** and the user `postgres.<project-ref>`. It looks like:

`postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`

`pg_dump` needs that session connection. Do not use the transaction pooler (port **6543**). The direct connection host (`db.<project-ref>.supabase.co`) is often IPv6-only, so it fails on many home and office networks that only have IPv4.

If the database password contains characters such as `@`, `:`, `/`, `?`, `#`, `[`, `]`, or `%`, URL-encode them in the URI. `@` is `%40`, `#` is `%23`, and `%` is `%25`.

Store the URI outside the repo, in a file with mode `600`, not in git and not in `.env`. `$HOME/.config/bloodline/db-url.env` should contain only:

```bash
SUPABASE_DB_URL='postgresql://postgres.<project-ref>:...@aws-0-<region>.pooler.supabase.com:5432/postgres'
```

### Weekly run

Git Bash or WSL:

```bash
set -a
# shellcheck disable=SC1090
source "$HOME/.config/bloodline/db-url.env"
set +a
export BACKUP_DIR="$HOME/bloodline-backups"
bash /path/to/bloodline_book/scripts/backup-db.sh
```

Run that same command by hand before `scripts/run-migrations.sh` or any SQL you apply in the dashboard, before you delete rows, and before `npm run test:isolation`.

On WSL, a Sunday cron entry on that machine (not in GitHub):

```cron
15 6 * * 0 bash -lc 'set -a; source "$HOME/.config/bloodline/db-url.env"; set +a; export BACKUP_DIR="$HOME/bloodline-backups"; bash "$HOME/src/bloodline_book/scripts/backup-db.sh"'
```

On Windows, point Task Scheduler at Git Bash with the same command, for example:

`C:\Program Files\Git\bin\bash.exe -lc "set -a; source \"$HOME/.config/bloodline/db-url.env\"; set +a; export BACKUP_DIR=\"$HOME/bloodline-backups\"; bash \"/c/src/bloodline_book/scripts/backup-db.sh\""`

Paths with spaces are fine. Quote them.

### Restore (`scripts/restore-db.sh`)

Restore only into a scratch project. The script reads `RESTORE_DB_URL` and `BACKUP_DIR` from the shell. Pass a timestamp to choose a set, or pass nothing to use the newest complete set.

It will not restore into the live project when `SUPABASE_DB_URL` is set. A matching host is refused. The session pooler hostname is shared by every project in a region, so a different `postgres.<project-ref>` on that same host is a different project and is allowed. The same project ref is refused even when one URI is the direct host and the other is the pooler. Every run also asks you to type the restore host. Typing it cannot override a live-project refusal.

A restore loads the public schema, then `auth.users` and `auth.identities`, then public table data (`psql -v ON_ERROR_STOP=1`). It then prints row counts for `auth.users` and for each `public` table that has rows.

A restore does not recreate Supabase project settings, auth provider settings, PowerSync config, API keys, or anything outside `public` plus `auth.users` and `auth.identities`.

### Test a restore

1. Create a free Supabase project used only as a scratch target. Do not use the farmer project.
2. Copy that project's session pooler URI (port 5432, user `postgres.<project-ref>`).
3. From your machine:

```bash
export SUPABASE_DB_URL='postgresql://...live...'
export RESTORE_DB_URL='postgresql://...scratch...'
export BACKUP_DIR="$HOME/bloodline-backups"
bash /path/to/bloodline_book/scripts/restore-db.sh
```

Type the scratch host when the script asks. It restores schema, then auth data, then public data.

4. Point the app at the scratch project, sign in as the demo user `demo@bloodlinebook.test`, and check that the goats appear. The demo password is the one you keep in the shell as `DEMO_PASSWORD` (see [TEST-ACCOUNT.md](TEST-ACCOUNT.md)). It is not stored in this repo.
5. Delete the scratch project when the check is done.

The same `psql` commands are in a comment at the top of each dump. Point them at `RESTORE_DB_URL` for the scratch project only.
