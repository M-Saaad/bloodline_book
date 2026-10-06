#!/usr/bin/env bash
# Restore a Bloodline Book backup into a scratch Supabase project.
#
# Required in the environment (shell only — never .env, never this repo):
#   RESTORE_DB_URL   Postgres URI of the scratch project
#   BACKUP_DIR       Directory written by scripts/backup-db.sh
# Optional:
#   SUPABASE_DB_URL  Live project URI. When it is set, this script refuses to
#                    restore into that same database.
# Argument:
#   timestamp        For example 20260101T120000Z. Omit to restore the newest set.
#
#   export RESTORE_DB_URL='postgresql://...scratch...'
#   export SUPABASE_DB_URL='postgresql://...live...'
#   export BACKUP_DIR="$HOME/bloodline-backups"
#   bash scripts/restore-db.sh
#   bash scripts/restore-db.sh 20260101T120000Z
#
# Restore order is public schema, then auth.users and auth.identities, then
# public data. psql stops on the first error.
#
# A restore does not recreate Supabase-managed objects:
#   - project settings
#   - auth provider settings (providers, email templates, redirect URLs)
#   - PowerSync config
#   - API keys
#   - anything outside the public schema plus auth.users and auth.identities
#     (storage, realtime, other auth tables, roles, extensions, database settings)

set -euo pipefail
# Command substitutions do not reliably honor set -e. Pair $(...) with "|| exit"
# wherever a helper can fail, especially the live-project guard.
shopt -s inherit_errexit 2>/dev/null || true

usage() {
  cat >&2 <<'EOF'
Usage: RESTORE_DB_URL=... BACKUP_DIR=... bash scripts/restore-db.sh [timestamp]
RESTORE_DB_URL is the scratch project's Postgres URI (shell only, never the live project).
BACKUP_DIR is the directory written by scripts/backup-db.sh.
Pass a timestamp such as 20260101T120000Z, or omit it to restore the newest set.
Set SUPABASE_DB_URL to the live URI so this script can refuse the live project.
EOF
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

lower_text() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

db_host() {
  local url="$1"
  local rest host
  case "$url" in
    postgres://* | postgresql://*) ;;
    *)
      fail "Database URL must start with postgresql:// or postgres://. The URL was not printed."
      ;;
  esac
  rest="${url#*://}"
  rest="${rest##*@}"
  if [[ "$rest" == \[* ]]; then
    host="${rest#\[}"
    host="${host%%]*}"
  else
    host="${rest%%[:/?]*}"
  fi
  if [[ -z "$host" ]]; then
    fail "Could not read a host from the database URL. The URL was not printed."
  fi
  printf '%s\n' "$host"
}

db_user() {
  local url="$1"
  local rest userinfo
  case "$url" in
    postgres://* | postgresql://*) ;;
    *)
      fail "Database URL must start with postgresql:// or postgres://. The URL was not printed."
      ;;
  esac
  rest="${url#*://}"
  if [[ "$rest" != *@* ]]; then
    printf '\n'
    return 0
  fi
  userinfo="${rest%@*}"
  printf '%s\n' "${userinfo%%:*}"
}

project_ref() {
  local user host
  user="$(lower_text "$1")"
  host="$(lower_text "$2")"
  if [[ "$user" =~ ^postgres\.([a-z0-9]+)$ ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
    return 0
  fi
  if [[ "$host" =~ ^db\.([a-z0-9]+)\.supabase\.co$ ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
    return 0
  fi
  printf '\n'
}

refuse_live_project() {
  local live_url="$1"
  local restore_url="$2"
  local live_host restore_host live_user restore_user live_ref restore_ref
  local live_host_l restore_host_l

  live_host="$(db_host "$live_url")" || exit 1
  restore_host="$(db_host "$restore_url")" || exit 1
  live_user="$(db_user "$live_url")" || exit 1
  restore_user="$(db_user "$restore_url")" || exit 1
  live_ref="$(project_ref "$live_user" "$live_host")" || exit 1
  restore_ref="$(project_ref "$restore_user" "$restore_host")" || exit 1
  live_host_l="$(lower_text "$live_host")" || exit 1
  restore_host_l="$(lower_text "$restore_host")" || exit 1

  # Session pooler hostnames are shared by every project in a region.
  # Different postgres.<project-ref> users on that host are different projects.
  # The same project ref is the live project even when one URI is the direct
  # host (db.<ref>.supabase.co) and the other is the pooler.
  if [[ "$live_host_l" == "$restore_host_l" ]]; then
    if [[ -n "$live_ref" && -n "$restore_ref" && "$live_ref" != "$restore_ref" ]]; then
      return 0
    fi
    fail "RESTORE_DB_URL host (${restore_host}) matches SUPABASE_DB_URL host. Refusing to restore into the live project."
  fi
  if [[ -n "$live_ref" && -n "$restore_ref" && "$live_ref" == "$restore_ref" ]]; then
    fail "RESTORE_DB_URL uses the same Supabase project ref (${live_ref}) as SUPABASE_DB_URL. Refusing to restore into the live project."
  fi
}

confirm_restore_host() {
  local restore_host="$1"
  local typed=""
  echo "Restore target host: ${restore_host}" >&2
  echo "Type that host exactly to continue:" >&2
  if ! IFS= read -r typed; then
    fail "No confirmation was entered. Aborting restore."
  fi
  if [[ "$typed" != "$restore_host" ]]; then
    fail "Confirmation did not match the restore host. Aborting restore."
  fi
}

newest_complete_stamp() {
  local dir="$1"
  local best="" f base ts
  local nullglob_was=0

  if shopt -q nullglob; then
    nullglob_was=1
  fi
  shopt -s nullglob
  for f in "$dir"/bloodline-schema-*.sql; do
    base="$(basename "$f")"
    ts="${base#bloodline-schema-}"
    ts="${ts%.sql}"
    if [[ ! "$ts" =~ ^[0-9]{8}T[0-9]{6}Z$ ]]; then
      continue
    fi
    if [[ -f "$dir/bloodline-auth-${ts}.sql" && -f "$dir/bloodline-data-${ts}.sql" ]]; then
      if [[ -z "$best" || "$ts" > "$best" ]]; then
        best="$ts"
      fi
    fi
  done
  if ((nullglob_was == 0)); then
    shopt -u nullglob
  fi
  if [[ -z "$best" ]]; then
    fail "No complete backup set in BACKUP_DIR. Each set needs bloodline-schema-<timestamp>.sql, bloodline-auth-<timestamp>.sql, and bloodline-data-<timestamp>.sql."
  fi
  printf '%s\n' "$best"
}

require_set() {
  local dir="$1"
  local stamp="$2"
  local schema_file auth_file data_file
  schema_file="${dir}/bloodline-schema-${stamp}.sql"
  auth_file="${dir}/bloodline-auth-${stamp}.sql"
  data_file="${dir}/bloodline-data-${stamp}.sql"
  if [[ ! -f "$schema_file" || ! -f "$auth_file" || ! -f "$data_file" ]]; then
    fail "Backup set ${stamp} is incomplete. Need bloodline-schema-${stamp}.sql, bloodline-auth-${stamp}.sql, and bloodline-data-${stamp}.sql in BACKUP_DIR."
  fi
}

print_row_counts() {
  local table count users tables
  users="$(psql "$RESTORE_DB_URL" -X -v ON_ERROR_STOP=1 -Atc 'SELECT count(*) FROM auth.users')" \
    || fail "Could not count auth.users after restore. The connection string was not printed."
  if [[ ! "$users" =~ ^[0-9]+$ ]]; then
    fail "Expected a numeric row count for auth.users after restore."
  fi
  echo "auth.users ${users}"

  tables="$(psql "$RESTORE_DB_URL" -X -v ON_ERROR_STOP=1 -Atc "SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY c.relname")" \
    || fail "Could not list public tables after restore. The connection string was not printed."

  while IFS= read -r table; do
    if [[ -z "$table" ]]; then
      continue
    fi
    if [[ ! "$table" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
      echo "WARNING: skipping a public table whose name is not a plain identifier." >&2
      continue
    fi
    count="$(psql "$RESTORE_DB_URL" -X -v ON_ERROR_STOP=1 -Atc "SELECT count(*) FROM public.\"${table}\"")" \
      || fail "Could not count public.${table} after restore. The connection string was not printed."
    if [[ ! "$count" =~ ^[0-9]+$ ]]; then
      fail "Expected a numeric row count for public.${table} after restore."
    fi
    if [[ "$count" != "0" ]]; then
      echo "public.${table} ${count}"
    fi
  done <<< "$tables"
}

main() {
  local stamp backup_abs restore_host
  local schema_file auth_file data_file

  if (($# > 1)); then
    usage
    fail "Pass one timestamp, or no arguments to restore the newest set."
  fi
  if [[ -z "${RESTORE_DB_URL:-}" ]]; then
    usage
    fail "RESTORE_DB_URL is not set. Export the scratch project's Postgres connection string in the shell. Do not read it from the repo or from .env."
  fi
  if [[ -z "${BACKUP_DIR:-}" ]]; then
    usage
    fail "BACKUP_DIR is not set. Point it at the directory written by scripts/backup-db.sh."
  fi
  if [[ ! -d "$BACKUP_DIR" ]]; then
    fail "BACKUP_DIR does not exist or is not a directory."
  fi

  if ! command -v psql >/dev/null 2>&1; then
    fail "psql is not installed. Install the PostgreSQL client tools (postgresql-client on Debian/Ubuntu, libpq on macOS, the PostgreSQL installer on Windows) and retry."
  fi

  backup_abs="$(cd "$BACKUP_DIR" && pwd -P)" || fail "Cannot resolve BACKUP_DIR."
  if [[ -n "${1:-}" ]]; then
    stamp="$1"
    if [[ ! "$stamp" =~ ^[0-9]{8}T[0-9]{6}Z$ ]]; then
      fail "Timestamp must look like 20260101T120000Z."
    fi
  else
    stamp="$(newest_complete_stamp "$backup_abs")" || exit 1
  fi
  require_set "$backup_abs" "$stamp"

  schema_file="${backup_abs}/bloodline-schema-${stamp}.sql"
  auth_file="${backup_abs}/bloodline-auth-${stamp}.sql"
  data_file="${backup_abs}/bloodline-data-${stamp}.sql"
  restore_host="$(db_host "$RESTORE_DB_URL")" || exit 1

  if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
    refuse_live_project "$SUPABASE_DB_URL" "$RESTORE_DB_URL"
  else
    echo "WARNING: SUPABASE_DB_URL is not set, so this script cannot tell the live project from the scratch project. Set SUPABASE_DB_URL to the live connection string before restoring." >&2
  fi

  echo "Backup set: ${stamp}"
  echo "  ${schema_file}"
  echo "  ${auth_file}"
  echo "  ${data_file}"
  confirm_restore_host "$restore_host"

  echo "Restoring schema into host ${restore_host}"
  psql "$RESTORE_DB_URL" -X -v ON_ERROR_STOP=1 -f "$schema_file"
  echo "Restoring auth data into host ${restore_host}"
  psql "$RESTORE_DB_URL" -X -v ON_ERROR_STOP=1 -f "$auth_file"
  echo "Restoring public data into host ${restore_host}"
  psql "$RESTORE_DB_URL" -X -v ON_ERROR_STOP=1 -f "$data_file"

  echo "Row counts:"
  print_row_counts
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
