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

The script discovers farm-scoped tables from `supabase/migrations/` (any table with a `farm_id` column) and writes one CSV per table under `exports/<farm-slug>-<YYYY-MM-DD>/`. Foreign-key ids stay in their original columns. Where it is straightforward, a readable name (and tag, for goats) is added in the next column — for example `animal_id` plus `animal_name` and `animal_tag`.

It does **not** export `farm_members` or `farm_invites`. Those tables hold other people’s email addresses.

`exports/` is gitignored. Do not commit the files.

### Send the files safely

Until the app has an in-app export, this is how you honour a farmer’s data request. Treat the CSVs like any other sensitive herd record.

1. Zip the export folder with a password. On macOS or Linux, for example:

   ```bash
   zip -er willow-creek-export.zip exports/willow-creek-2026-10-07
   ```

   (`zip` prompts for the password interactively; do not put the password in shell history.)

2. Send the zip through your usual support channel (email attachment, ticket, etc.).
3. Send the zip password **separately** — another message, another channel, or after the farmer confirms they received the file.
4. When the farmer confirms they have the data, delete the zip and the `exports/` folder from your machine.

### Run

```bash
export SUPABASE_URL='https://YOUR_PROJECT.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'
node scripts/export-farm-csv.mjs "Willow Creek"
```

You can pass a farm id instead of a name. The script prints the project URL and waits for `yes` before it reads any rows. If several farms share the name, it lists their ids and stops.

## Farm deletion (`scripts/admin-delete-farm.mjs`)

**When to use it:** A farmer asks you to delete their farm and all associated data (for example under a privacy or account-closure request).

The script permanently removes one farm’s rows, files in the **documents** Storage bucket for that farm, and the `farms` row. It uses the service role key and bypasses RLS.

**Before you run it:**

1. Take a database backup (`scripts/backup-db.sh`).
2. Export the farm to CSV the same day (`scripts/export-farm-csv.mjs`). The delete script refuses to run unless today’s export folder exists under `exports/<farm-slug>-<YYYY-MM-DD>/`, unless you pass `--no-export-check`.

### Run

```bash
export SUPABASE_URL='https://YOUR_PROJECT.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'
node scripts/admin-delete-farm.mjs "Willow Creek"
```

You can pass a farm id instead of a name. The script prints the project URL, then a summary (farm name and id, members with masked emails like `j***@gmail.com`, and row counts per farm-scoped table). It stops unless you type the **exact** farm name.

It then asks separately whether to delete **auth users** who would belong to no other farm after this deletion. The default is **no** (press Enter or answer `n`).

Pass `--no-export-check` only if you already exported the farm elsewhere today.

### What gets deleted

- Objects in the Supabase Storage **documents** bucket referenced by `documents.storage_path` and any objects under a `{farm_id}/` prefix in that bucket.
- Rows in farm-scoped tables (animals, health, breeding, finances, pastures, documents metadata, `farm_members`, `farm_invites`, and the rest), in an order that respects foreign keys in `supabase/migrations/`.
- The `farms` row.
- Optionally, orphaned `auth.users` records when you confirm that step.

The script prints a line for each category and table it removed.

### Backups and privacy wording

Supabase project **backups** (and any copies you keep from `scripts/backup-db.sh`) may still hold deleted data for their retention period. If you tell a farmer their data is gone, say that operational backups may retain copies until those backups expire, unless you have removed or overwritten them.

## Database backup (`scripts/backup-db.sh`)

**When to run it:** from your own machine, once a week, and again before every migration, before you delete data, and before the isolation test (`npm run test:isolation`). The dump contains farmer records, emails, and password hashes. Keep it outside this repo.

This repository is public. Do **not** add a GitHub Actions workflow for backups. Artifacts from a public repo can be downloaded by other GitHub users.

The script reads `SUPABASE_DB_URL` and `BACKUP_DIR` from the shell only. It does not read `.env` or anything checked into the repo. It refuses to run if `BACKUP_DIR` is inside the git checkout, including when a symlink makes that path land inside the repo or the path you named is a symlink inside the repo. It never prints the connection string. It prints the database host only.

It uses `pg_dump` and `psql` only. It does not call the Supabase CLI and it does not need Docker. Before dumping, it runs `psql "$SUPABASE_DB_URL" -Atc 'show server_version'` and exits if `pg_dump` is older than the server. If `pg_dump` or `psql` is missing, the script prints how to install the PostgreSQL client tools on Windows, macOS, and Linux.

One run writes three files that share a timestamp:

- `bloodline-schema-<timestamp>.sql` — `public` schema, plus `DROP TRIGGER IF EXISTS` and `CREATE TRIGGER` for every non-internal trigger on `auth.users` whose function is in `public` (so the invite trigger is restored with the schema)
- `bloodline-auth-<timestamp>.sql` — `auth.users` and `auth.identities`
- `bloodline-data-<timestamp>.sql` — `public` table data

The auth and public data files begin with `SET session_replication_role = replica;` so a restore does not fire `handle_new_farm` or `accept_farm_invites_for_user`. Those triggers insert into `farm_members` and break foreign keys. Every file includes a header comment with the restore order and commands: schema, then auth data, then public data. After a successful dump the script keeps the newest 8 sets. The three files from one run are always kept or removed together. It prints each file's size in bytes and how many `COPY` blocks it contains, and it sets mode `600` where the system allows it.

The auth file contains emails and password hashes. Keep it private. Do not commit it, and do not email it.

Do not put `BACKUP_DIR` in OneDrive, Dropbox, or any other synced folder unless that folder is encrypted. Sync clients copy the files onto other machines and into the cloud.

## Disaster recovery

1. Run `scripts/backup-db.sh` weekly and again before any risky change (migrations, bulk deletes, isolation tests).
2. Copy the whole backup folder somewhere outside this git repository and outside the machine that took the backup.
3. To restore: save a validation matrix from the database you are replacing (`scripts/db-validation-matrix.sh`), run `scripts/restore-db.sh` with `RESTORE_INTO_SOURCE=yes` when rebuilding the farmer project (see [Disaster recovery in place](#disaster-recovery-in-place)), then compare matrices with `scripts/compare-validation.sh`.
4. After a restore, open the PowerSync dashboard and confirm replication looks healthy, then sign in to the app once so auth sessions refresh.

`restore-db.sh` drops the exact line `CREATE SCHEMA public;` from a temporary copy of the schema file when present, because Supabase already has the `public` schema. The backup files on disk are not modified.

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

## Off-site encrypted backup (`scripts/backup-offsite.sh`)

**When to run it:** after `scripts/backup-db.sh` on a schedule, or instead of copying the backup folder by hand. The script runs `backup-db.sh`, encrypts the three SQL files for that run, uploads them with `rclone`, checks remote file sizes, keeps the newest **8** complete sets on the remote, and deletes the local **plaintext** SQL files for that set. Encrypted blobs may remain in `BACKUP_DIR` until you remove them.

This repository is public. Do **not** add a GitHub Actions workflow that uploads backups. Use your own machine, a private cron host, or a Cursor Cloud Agent secret set on a manual schedule.

The script never reads `.env`, never prints `SUPABASE_DB_URL` or `BACKUP_PASSPHRASE`, and refuses to run when `BACKUP_DIR` is inside this git checkout (same rule as `backup-db.sh`).

### One-time setup

1. **Create a private bucket** on [Backblaze B2](https://www.backblaze.com/b2/cloud-storage.html) or [Cloudflare R2](https://developers.cloudflare.com/r2/). Block public access. Use a dedicated bucket for Bloodline backups only.

2. **Create an access key** limited to that bucket (read, write, list, delete on that bucket prefix only). Do not reuse keys from the app or from Supabase.

3. **Install tools** on the machine that will run backups: PostgreSQL client (`pg_dump`, `psql`), `rclone`, and either [`age`](https://github.com/FiloSottile/age) or OpenSSL. The script prefers `age` when it is on `PATH`; otherwise it uses `openssl enc -aes-256-cbc -pbkdf2 -salt`.

4. **Configure rclone only with environment variables** (no `rclone.conf` in this repo). The remote name is always `offsite`. Examples:

   **Cloudflare R2**

   ```bash
   export RCLONE_CONFIG_OFFSITE_TYPE=s3
   export RCLONE_CONFIG_OFFSITE_PROVIDER=Cloudflare
   export RCLONE_CONFIG_OFFSITE_ACCESS_KEY_ID='your-r2-access-key-id'
   export RCLONE_CONFIG_OFFSITE_SECRET_ACCESS_KEY='your-r2-secret'
   export RCLONE_CONFIG_OFFSITE_ENDPOINT='https://<account-id>.r2.cloudflarestorage.com'
   export RCLONE_CONFIG_OFFSITE_ACL=private
   export BACKUP_REMOTE_PATH='offsite:your-bucket-name/bloodline'
   ```

   **Backblaze B2 (S3-compatible API)**

   ```bash
   export RCLONE_CONFIG_OFFSITE_TYPE=s3
   export RCLONE_CONFIG_OFFSITE_PROVIDER=Other
   export RCLONE_CONFIG_OFFSITE_ACCESS_KEY_ID='your-b2-key-id'
   export RCLONE_CONFIG_OFFSITE_SECRET_ACCESS_KEY='your-b2-application-key'
   export RCLONE_CONFIG_OFFSITE_ENDPOINT='https://s3.<region>.backblazeb2.com'
   export RCLONE_CONFIG_OFFSITE_ACL=private
   export BACKUP_REMOTE_PATH='offsite:your-bucket-name/bloodline'
   ```

   Adjust `BACKUP_REMOTE_PATH` to your bucket and folder. The part before the colon must be `offsite`.

5. **Cursor secrets (or your shell profile on a private host)** — store these outside the repo; never commit values:

   | Secret | Purpose |
   |--------|---------|
   | `SUPABASE_DB_URL` | Session pooler URI for `backup-db.sh` |
   | `BACKUP_DIR` | Absolute path **outside** this repository |
   | `BACKUP_PASSPHRASE` | Encrypts every backup file (long random string) |
   | `BACKUP_REMOTE_PATH` | e.g. `offsite:my-bucket/bloodline` |
   | `RCLONE_CONFIG_OFFSITE_TYPE` | `s3` for B2 or R2 |
   | `RCLONE_CONFIG_OFFSITE_PROVIDER` | `Cloudflare` or `Other` (B2) |
   | `RCLONE_CONFIG_OFFSITE_ACCESS_KEY_ID` | Bucket-scoped key |
   | `RCLONE_CONFIG_OFFSITE_SECRET_ACCESS_KEY` | Bucket-scoped secret |
   | `RCLONE_CONFIG_OFFSITE_ENDPOINT` | Provider endpoint URL |
   | `RCLONE_CONFIG_OFFSITE_ACL` | `private` |

   Add any other `RCLONE_CONFIG_OFFSITE_*` options your provider requires. Test with `rclone lsd "$BACKUP_REMOTE_PATH"` before the first backup.

6. **Rehearse restore once** from a copy you download from the bucket (see below). A backup you have never restored is only a hope.

### Run

```bash
set -a
# shellcheck disable=SC1090
source "$HOME/.config/bloodline/db-url.env"
set +a
export BACKUP_DIR="$HOME/bloodline-backups"
export BACKUP_PASSPHRASE='your-long-random-passphrase'
# export RCLONE_CONFIG_OFFSITE_* and BACKUP_REMOTE_PATH as above
bash /path/to/bloodline_book/scripts/backup-offsite.sh
```

Run weekly (or use the same cron as `backup-db.sh` but call `backup-offsite.sh` instead of `backup-db.sh` alone). Run again before migrations, bulk deletes, and `npm run test:isolation`.

### Download, decrypt, and restore

1. Download the three encrypted files for one timestamp from the bucket (rclone, provider UI, or CLI). Example:

   ```bash
   export BACKUP_REMOTE_PATH='offsite:your-bucket/bloodline'
   mkdir -p "$HOME/bloodline-restore-incoming"
   rclone copy "$BACKUP_REMOTE_PATH" "$HOME/bloodline-restore-incoming" \
     --include 'bloodline-*-20260101T120000Z.sql.*'
   ```

2. **Decrypt** each file into a directory that is **not** inside this git repo (for example `$HOME/bloodline-backups`):

   **If the files end in `.age` (age):**

   ```bash
   export BACKUP_PASSPHRASE='same passphrase used at backup time'
   age -d -p -o "$HOME/bloodline-backups/bloodline-schema-20260101T120000Z.sql" \
     "$HOME/bloodline-restore-incoming/bloodline-schema-20260101T120000Z.sql.age"
   # repeat for auth and data
   ```

   **If the files end in `.enc` (OpenSSL):**

   ```bash
   export BACKUP_PASSPHRASE='same passphrase used at backup time'
   openssl enc -d -aes-256-cbc -pbkdf2 \
     -in "$HOME/bloodline-restore-incoming/bloodline-schema-20260101T120000Z.sql.enc" \
     -out "$HOME/bloodline-backups/bloodline-schema-20260101T120000Z.sql" \
     -pass env:BACKUP_PASSPHRASE
   # repeat for auth and data
   ```

3. **Restore** with `scripts/restore-db.sh` into a **scratch** Supabase project first (see [Test a restore](#test-a-restore)). Only use [Disaster recovery in place](#disaster-recovery-in-place) when you intend to rebuild the farmer project.

4. **Rehearsal:** at least once, download a set from the remote (not only from local disk), decrypt it, and run a scratch restore. Confirm goats and auth work, then delete the scratch project. Update your calendar when you last rehearsed.

Plaintext SQL after decrypt still contains emails and password hashes. Keep it out of the repo and off sync folders.

### Restore (`scripts/restore-db.sh`)

Restore only into a scratch project. The script reads `RESTORE_DB_URL` and `BACKUP_DIR` from the shell. Pass a timestamp to choose a set, or pass nothing to use the newest complete set.

It will not restore into the live project when `SUPABASE_DB_URL` is set. A matching host is refused. The session pooler hostname is shared by every project in a region, so a different `postgres.<project-ref>` on that same host is a different project and is allowed. The same project ref is refused even when one URI is the direct host and the other is the pooler. Every run also asks you to type the restore host. Typing the host cannot by itself override that refusal. The only override is in-place disaster recovery, and it still refuses a target that is not empty. See [Disaster recovery in place](#disaster-recovery-in-place).

A restore loads the public schema, then `auth.users` and `auth.identities`, then public table data (`psql -v ON_ERROR_STOP=1`). Schema restore skips the exact line `CREATE SCHEMA public;` when the backup contains it (Supabase already has `public`); the on-disk backup is unchanged. It then prints row counts for `auth.users` and for each `public` table that has rows.

After the schema load, if a publication named `powersync` exists and is not `FOR ALL TABLES`, the script adds every base table in `public` to it. If that publication is missing, or it is `FOR ALL TABLES`, the script prints what it found and does not change it. When the restore finishes, it prints a reminder to re-check the publication and the PowerSync connection. The SQL for that check is in [After a restore: reconnect PowerSync](#after-a-restore-reconnect-powersync).

A restore does not recreate Supabase project settings, auth provider settings, PowerSync config (the PowerSync instance, sync rules, or API keys), or anything outside `public` plus `auth.users` and `auth.identities`. The schema file does restore non-internal triggers on `auth.users` whose function is in `public`, including the invite trigger, when that trigger existed at backup time.

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

## Disaster recovery in place

Use this only when the farmer project itself has to be rebuilt and a scratch project will not do. Take a backup first. The normal restore path still refuses the source project. The in-place path is an override, and it refuses a target that is not empty.

Nothing in this section reads `.env` or prints the connection string. Keep the backup files, the matrix files, and the connection string outside the git repo.

### 1. Save a validation matrix

`scripts/db-validation-matrix.sh` is read-only. It uses `psql` only, in one read-only transaction. Run it before the wipe, against the same database the backup describes (take a fresh backup first if the last one is older than the data you want back).

```bash
bash /path/to/bloodline_book/scripts/db-validation-matrix.sh "$HOME/bloodline-backups/matrix-before.tsv"
```

That reads `SUPABASE_DB_URL`. `--url-var NAME` reads a different variable, which is how you point the same script at `RESTORE_DB_URL` after the restore. The script prints the host once, on a `#` line, with a UTC timestamp. The rest of the file is a tab-separated matrix, sorted so two runs against an identical database match once that header is ignored:

- every base table in `public`: name, exact row count, and `md5` of `t::text` ordered by that text
- the same count and `md5` for `auth.users` and `auth.identities`
- counts of tables, columns per table, indexes, constraints, RLS-enabled tables, policies (`pg_policies`), functions in `public`, triggers on `public` tables, and types in `public`
- the name of each non-internal trigger on `auth.users`
- each publication: its name, whether it is `FOR ALL TABLES`, and the tables it contains

The hash reads every row. The file is not a dump, but it is still derived from farmer data. Do not commit it.

### 2. Wipe the target

The override checks two facts and prints them before it writes:

- schema `public` has no base tables (`relkind = 'r'`)
- `auth.users` has zero rows

Any public base table, or any row in `auth.users`, stops the restore. Typing the host does not skip that check.

The schema file is a `pg_dump` of `public`, so the objects it creates have to be gone as well, or `psql` stops on the first one that already exists. From `psql` against that project, after the backup is safely outside the repo:

```sql
DO $$
DECLARE
  name text;
  fn regprocedure;
BEGIN
  FOR name IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
    ORDER BY c.relname
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', name);
  END LOOP;

  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.objid = p.oid AND d.deptype = 'e'
      )
  LOOP
    EXECUTE 'DROP FUNCTION ' || fn::text || ' CASCADE';
  END LOOP;
END $$;

DELETE FROM auth.users;
```

`DROP FUNCTION ... CASCADE` also drops the invite trigger on `auth.users`, because that trigger calls `public.accept_farm_invites_for_user()`. The schema file puts that trigger back.

On Supabase, deleting `auth.users` also removes `auth.identities` and the other auth rows that reference the user. If a foreign key blocks the delete, delete those referencing rows first, then delete `auth.users` again. The restore still requires the `auth.users` count to be zero.

Confirm both counts are `0` before you restore:

```sql
SELECT count(*)
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r';

SELECT count(*) FROM auth.users;
```

### 3. Restore in place

```bash
export RESTORE_INTO_SOURCE=yes
export SUPABASE_DB_URL='postgresql://...source...'
export RESTORE_DB_URL='postgresql://...same project...'
export BACKUP_DIR="$HOME/bloodline-backups"
bash /path/to/bloodline_book/scripts/restore-db.sh
```

`RESTORE_INTO_SOURCE` must be the exact word `yes`. The script prints the target host and waits for you to type it. It then prints what it checked: `RESTORE_INTO_SOURCE=yes`, the host you typed, the public base-table count (and names, when there are any), and the `auth.users` count. Then it loads schema, auth data, and public data.

Leaving `RESTORE_INTO_SOURCE` unset keeps the refusal, even if you would have typed the host. Setting it does not skip the host prompt. A non-empty target is refused before any backup file is applied.

After the schema load, the script checks publication `powersync`:

- not found: it says so and adds nothing
- `FOR ALL TABLES`: it says so and leaves the publication unchanged
- otherwise: it adds every base table in `public` that is not already a member, and prints the names

### 4. Compare the matrices

```bash
bash /path/to/bloodline_book/scripts/db-validation-matrix.sh \
  --url-var RESTORE_DB_URL \
  "$HOME/bloodline-backups/matrix-after.tsv"
bash /path/to/bloodline_book/scripts/compare-validation.sh \
  "$HOME/bloodline-backups/matrix-before.tsv" \
  "$HOME/bloodline-backups/matrix-after.tsv"
```

`compare-validation.sh` ignores `#` lines, so the host and timestamp may differ. Exit 0 means the remaining rows match. Exit 1 prints a table of rows that changed, rows only in the before file, and rows only in the after file.

Compare a matrix taken from the database you dumped. A matrix from before a later migration will not match a restore of an older backup.

### What a restore does not recreate

A restore does not recreate:

- Supabase project settings
- auth provider settings (providers, email templates, redirect URLs)
- PowerSync config: the PowerSync instance, sync rules, and API keys. The script only adds `public` base tables to an existing `powersync` publication that is not `FOR ALL TABLES`. It does not create the publication or the replication role.
- API keys
- storage objects, realtime, roles, extensions, and database settings
- auth tables other than `auth.users` and `auth.identities` (sessions and refresh tokens are not in the dump, so farmers sign in again)

The schema file does recreate non-internal triggers on `auth.users` whose function is in `public`, including `on_auth_user_created_accept_invites`, when that trigger was present for the backup. The auth and public data files still set `session_replication_role` to `replica`, so those triggers do not fire while the rows are loaded.

## After a restore: reconnect PowerSync

`scripts/restore-db.sh` prints a reminder when it finishes. A restore does not recreate the PowerSync service, the sync rules, or the password stored in the PowerSync connection. Dropping and recreating `public` removes a publication that listed individual tables. A publication that is `FOR ALL TABLES` keeps that setting, and new tables join it. A password reset does not update the connection PowerSync already saved.

Phones that have synced before still show the farm and the herd from the local database while sync is down. New changes stay on the phone until replication is connected again.

Run the SQL below in `psql` against the farmer database (`SUPABASE_DB_URL`). It does not print the connection string or the role password. It is safe to run more than once. It does not set a password. If `powersync_role` is missing, it stops. Create that role with a password in the Supabase SQL editor (see `supabase/README.md`), then run this again.

The publication block creates `powersync` for the synced `public` tables when the publication is missing. Those tables are the ones in `powersync/sync-rules.yaml`: `farms`, `farm_members`, `breeds`, `animals`, `weigh_sessions`, `weight_logs`, `transactions`, `farm_invites`, `documents`, `tasks`, `kidding_events`, `breeding_events`, `health_records`, `pastures`, `grazing_records`, `feed_logs`. If the publication exists and is not `FOR ALL TABLES`, missing tables from that list are added. If it is `FOR ALL TABLES`, it is left as it is. An active replication slot is left in place. The last statement drops only inactive slots whose names start with `powersync` and that still hold WAL. A slot that is streaming when that statement runs is not dropped. If the grants disconnect a replica, that slot is inactive and is removed so the next connection can create a fresh one. Run that statement on its own, outside a `BEGIN` block.

```sql
DO $$
DECLARE
  pub_all boolean;
  tbl text;
  synced text[] := ARRAY[
    'farms',
    'farm_members',
    'breeds',
    'animals',
    'weigh_sessions',
    'weight_logs',
    'transactions',
    'farm_invites',
    'documents',
    'tasks',
    'kidding_events',
    'breeding_events',
    'health_records',
    'pastures',
    'grazing_records',
    'feed_logs'
  ];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'powersync_role') THEN
    RAISE EXCEPTION 'powersync_role does not exist';
  END IF;

  EXECUTE 'ALTER ROLE powersync_role WITH REPLICATION BYPASSRLS LOGIN';
  EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA public TO powersync_role';
  EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO powersync_role';

  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'powersync') THEN
    EXECUTE
      'CREATE PUBLICATION powersync FOR TABLE '
      || (
        SELECT string_agg(format('public.%I', name), ', ' ORDER BY name)
        FROM unnest(synced) AS name
      );
    RETURN;
  END IF;

  SELECT p.puballtables INTO pub_all
  FROM pg_publication p
  WHERE p.pubname = 'powersync';

  IF pub_all THEN
    RETURN;
  END IF;

  FOREACH tbl IN ARRAY synced LOOP
    IF to_regclass(format('public.%I', tbl)) IS NULL THEN
      RAISE EXCEPTION 'synced table public.% is missing', tbl;
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'powersync'
        AND schemaname = 'public'
        AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION powersync ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END $$;

SELECT pg_drop_replication_slot(slot_name)
FROM pg_replication_slots
WHERE slot_name LIKE 'powersync%'
  AND NOT active
  AND restart_lsn IS NOT NULL;
```

Then re-check, still with `SELECT` only:

- `pg_publication`: a row named `powersync`, and whether `puballtables` is true
- `pg_publication_tables`: the synced `public` tables above are present
- `pg_replication_slots`: any `powersync` slot, and whether it is active
- `powersync_role`: `rolreplication` is true, `has_table_privilege` is true for every `public` base table, and `pg_default_acl` for the table owner grants `SELECT` to `powersync_role`

If the database password changed, update the PowerSync connection with the new password. Do not paste the password into this repo, a shell log, or a ticket. The direct host `db.<project-ref>.supabase.co` is often IPv6-only. A pooler URI is the right string for `psql` and `pg_dump`. Logical replication still uses the direct host from PowerSync.
