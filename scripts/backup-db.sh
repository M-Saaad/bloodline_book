#!/usr/bin/env bash
# Backup the Bloodline Book Postgres database to BACKUP_DIR.
#
# Reads SUPABASE_DB_URL and BACKUP_DIR from the shell environment only.
# Never source .env. Never put the database URL in this repo.
#
# Usage:
#   export SUPABASE_DB_URL='postgresql://...'
#   export BACKUP_DIR='/var/backups/bloodline'
#   bash scripts/backup-db.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCHEMA_TMP=""
DATA_TMP=""

cleanup_tmp() {
  if [[ -n "${SCHEMA_TMP:-}" ]]; then
    rm -f "$SCHEMA_TMP"
  fi
  if [[ -n "${DATA_TMP:-}" ]]; then
    rm -f "$DATA_TMP"
  fi
}

usage() {
  echo "Usage: SUPABASE_DB_URL=... BACKUP_DIR=... bash scripts/backup-db.sh" >&2
  echo "SUPABASE_DB_URL is the Postgres connection string (shell only, never from the repo)." >&2
  echo "BACKUP_DIR must be a directory outside this git repository." >&2
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

prune_keep_newest() {
  local keep="$1"
  local dir="$2"
  local pattern="$3"
  local -a files=()
  local path

  while IFS=$'\t' read -r _mtime path; do
    [[ -n "$path" ]] || continue
    files+=("$path")
  done < <(find "$dir" -maxdepth 1 -type f -name "$pattern" -printf '%T@\t%p\n' | sort -nr)

  if ((${#files[@]} > keep)); then
    rm -f -- "${files[@]:keep}"
  fi
}

prepend_restore_comment() {
  local file="$1"
  local schema_name="$2"
  local data_name="$3"
  local tmp
  tmp="$(mktemp)"
  cat >"$tmp" <<EOF
-- Bloodline Book database backup.
-- Restore into an EMPTY scratch database, schema file first, then data:
--   psql "\$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f ${schema_name}
--   psql "\$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f ${data_name}
-- Use the scratch project's connection string. Do not restore over the live farmer database.
--
EOF
  cat "$file" >>"$tmp"
  mv "$tmp" "$file"
}

dump_with_supabase() {
  local schema_file="$1"
  local data_file="$2"
  supabase db dump --db-url "$SUPABASE_DB_URL" --file "$schema_file"
  supabase db dump --db-url "$SUPABASE_DB_URL" --data-only --use-copy --file "$data_file"
}

dump_with_pg_dump() {
  local schema_file="$1"
  local data_file="$2"
  pg_dump "$SUPABASE_DB_URL" --schema-only --no-owner --no-privileges --file "$schema_file"
  pg_dump "$SUPABASE_DB_URL" --data-only --no-owner --no-privileges --file "$data_file"
}

main() {
  if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
    usage
    fail "SUPABASE_DB_URL is not set. Export the Postgres connection string in the shell. Do not read it from the repo."
  fi

  if [[ -z "${BACKUP_DIR:-}" ]]; then
    usage
    fail "BACKUP_DIR is not set. Choose a directory outside this git repository."
  fi

  local repo_root backup_abs
  repo_root="$(git -C "$ROOT" rev-parse --show-toplevel)"
  repo_root="$(realpath -m "$repo_root")"
  backup_abs="$(realpath -m "$BACKUP_DIR")"

  case "$backup_abs" in
    "$repo_root"|"$repo_root"/*)
      fail "BACKUP_DIR (${backup_abs}) is inside the git repository (${repo_root}). Refusing to write farmer data into the repo."
      ;;
  esac

  mkdir -p "$backup_abs"

  local stamp schema_final data_final
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  schema_final="${backup_abs}/bloodline-schema-${stamp}.sql"
  data_final="${backup_abs}/bloodline-data-${stamp}.sql"
  SCHEMA_TMP="$(mktemp "${backup_abs}/.bloodline-schema.XXXXXX")"
  DATA_TMP="$(mktemp "${backup_abs}/.bloodline-data.XXXXXX")"
  trap cleanup_tmp EXIT

  if command -v supabase >/dev/null 2>&1; then
    echo "Dumping with supabase db dump"
    dump_with_supabase "$SCHEMA_TMP" "$DATA_TMP"
  elif command -v pg_dump >/dev/null 2>&1; then
    echo "Dumping with pg_dump (Supabase CLI is not installed)"
    dump_with_pg_dump "$SCHEMA_TMP" "$DATA_TMP"
  else
    fail "Neither the Supabase CLI nor pg_dump is installed."
  fi

  prepend_restore_comment "$SCHEMA_TMP" "$(basename "$schema_final")" "$(basename "$data_final")"
  prepend_restore_comment "$DATA_TMP" "$(basename "$schema_final")" "$(basename "$data_final")"

  mv "$SCHEMA_TMP" "$schema_final"
  mv "$DATA_TMP" "$data_final"
  SCHEMA_TMP=""
  DATA_TMP=""

  prune_keep_newest 8 "$backup_abs" 'bloodline-schema-*.sql'
  prune_keep_newest 8 "$backup_abs" 'bloodline-data-*.sql'

  echo "Wrote:"
  stat -c '%s bytes  %n' "$schema_final" "$data_final"
  echo "Restore into an empty scratch database (schema, then data):"
  echo "  psql \"\$SUPABASE_DB_URL\" -v ON_ERROR_STOP=1 -f $(basename "$schema_final")"
  echo "  psql \"\$SUPABASE_DB_URL\" -v ON_ERROR_STOP=1 -f $(basename "$data_final")"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
