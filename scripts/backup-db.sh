#!/usr/bin/env bash
# Backup the Bloodline Book Postgres database to BACKUP_DIR.
#
# Reads SUPABASE_DB_URL and BACKUP_DIR from the shell environment only.
# Never source .env. Never put the database URL in this repo. Never print the URL.
#
# Writes three files that share one timestamp:
#   bloodline-schema-<ts>.sql   public schema, plus non-internal triggers on
#                               auth.users whose function is in schema public
#   bloodline-auth-<ts>.sql     auth.users and auth.identities
#   bloodline-data-<ts>.sql     public table data
#
# Usage:
#   export SUPABASE_DB_URL='postgresql://...'
#   export BACKUP_DIR='/var/backups/bloodline'
#   bash scripts/backup-db.sh

set -euo pipefail
# Command substitutions do not reliably honor set -e. Keep safety checks in the
# main shell, and pair $(...) with an explicit "|| exit" where a helper can fail.
shopt -s inherit_errexit 2>/dev/null || true

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SUCCESS=0
PARTIAL_FILES=()

usage() {
  cat >&2 <<'EOF'
Usage: SUPABASE_DB_URL=... BACKUP_DIR=... bash scripts/backup-db.sh
SUPABASE_DB_URL is the Postgres connection string (shell only, never from the repo).
BACKUP_DIR must be a directory outside this git repository.
EOF
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

track() {
  PARTIAL_FILES+=("$1")
}

cleanup_partial() {
  local f
  if ((SUCCESS)); then
    return 0
  fi
  if ((${#PARTIAL_FILES[@]} == 0)); then
    return 0
  fi
  for f in "${PARTIAL_FILES[@]}"; do
    if [[ -n "$f" ]]; then
      rm -f -- "$f"
    fi
  done
}

on_exit() {
  local status=$?
  set +e
  cleanup_partial
  exit "$status"
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

resolve_path() {
  local mode="$1"
  local target="$2"
  local suffix="" dir base next

  while [[ "$target" == */ && ${#target} -gt 1 ]]; do
    target="${target%/}"
  done
  case "$target" in
    /* | [A-Za-z]:/* | [A-Za-z]:\\*) ;;
    *) target="$(pwd)/$target" ;;
  esac

  dir="$target"
  while [[ ! -d "$dir" ]]; do
    next="$(dirname "$dir")"
    if [[ "$next" == "$dir" ]]; then
      fail "Cannot resolve BACKUP_DIR."
    fi
    suffix="/$(basename "$dir")${suffix}"
    dir="$next"
  done

  if [[ "$mode" == "P" ]]; then
    base="$(cd "$dir" && pwd -P)" || fail "Cannot resolve BACKUP_DIR."
  else
    base="$(cd "$dir" && pwd -L)" || fail "Cannot resolve BACKUP_DIR."
  fi
  if [[ "$base" == "/" ]]; then
    if [[ -z "$suffix" ]]; then
      printf '%s\n' "/"
    else
      printf '%s\n' "$suffix"
    fi
    return 0
  fi
  printf '%s%s\n' "$base" "$suffix"
}

path_is_inside() {
  local child="$1"
  local parent="$2"
  if [[ -z "$child" || -z "$parent" ]]; then
    return 1
  fi
  case "$child" in
    "$parent" | "$parent"/*) return 0 ;;
  esac
  return 1
}

assert_backup_outside_repo() {
  local repo_git repo_physical repo_logical backup_physical backup_logical
  repo_git="$(git -C "$ROOT" rev-parse --show-toplevel)" || fail "Cannot find the git repository root."
  repo_physical="$(cd "$repo_git" && pwd -P)" || fail "Cannot resolve the git repository root."
  repo_logical="$(cd "$repo_git" && pwd -L)" || fail "Cannot resolve the git repository root."
  backup_physical="$(resolve_path P "$BACKUP_DIR")" || exit 1
  backup_logical="$(resolve_path L "$BACKUP_DIR")" || exit 1

  if path_is_inside "$backup_physical" "$repo_physical" \
    || path_is_inside "$backup_physical" "$repo_logical" \
    || path_is_inside "$backup_logical" "$repo_physical" \
    || path_is_inside "$backup_logical" "$repo_logical"; then
    fail "BACKUP_DIR (${backup_logical}) is inside the git repository (${repo_physical}), including via a symlink. Refusing to write farmer data into the repo. Resolved path: ${backup_physical}"
  fi
  RESOLVED_BACKUP_DIR="$backup_physical"
}

install_help() {
  cat >&2 <<'EOF'
Install the PostgreSQL client tools so both pg_dump and psql are on PATH, then open a new shell.

  Windows (Git Bash or WSL)
    Download the installer from https://www.postgresql.org/download/windows/
    and add its bin directory to PATH, for example:
      C:\Program Files\PostgreSQL\17\bin
    Or, from an elevated PowerShell prompt:
      winget install -e --id PostgreSQL.PostgreSQL
    On WSL (Ubuntu/Debian):
      sudo apt-get update && sudo apt-get install -y postgresql-client

  macOS
    brew install libpq
    brew link --force libpq
    Put libpq's bin directory on PATH (brew prints the path after install).
    Or install the full package: brew install postgresql

  Linux
    Debian/Ubuntu: sudo apt-get update && sudo apt-get install -y postgresql-client
    Fedora/RHEL:   sudo dnf install -y postgresql
    Arch:          sudo pacman -S --needed postgresql
EOF
}

require_client_tools() {
  local missing=0
  if ! command -v pg_dump >/dev/null 2>&1; then
    echo "ERROR: pg_dump is not installed." >&2
    missing=1
  fi
  if ! command -v psql >/dev/null 2>&1; then
    echo "ERROR: psql is not installed." >&2
    missing=1
  fi
  if ((missing)); then
    install_help
    exit 1
  fi
}

strip_cr() {
  local raw="$1"
  raw="${raw//$'\r'/}"
  printf '%s\n' "${raw%%$'\n'*}"
}

major_from_server_version() {
  local raw
  raw="$(strip_cr "$1")"
  if [[ "$raw" =~ ^[[:space:]]*([0-9]+) ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
    return 0
  fi
  fail "Could not parse the server version reported by psql."
}

major_from_pg_dump_version() {
  local raw
  raw="$(strip_cr "$1")"
  if [[ "$raw" =~ ([0-9]+)\.[0-9]+ ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
    return 0
  fi
  fail "Could not parse the pg_dump version."
}

assert_dump_new_enough() {
  local host server_raw dump_raw server_major dump_major
  host="$(db_host "$SUPABASE_DB_URL")" || exit 1
  echo "Database host: ${host}"
  server_raw="$(psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -Atc 'show server_version')" \
    || fail "psql could not read the server version. The connection string was not printed."
  dump_raw="$(pg_dump --version)" || fail "Could not run pg_dump --version."
  server_major="$(major_from_server_version "$server_raw")"
  dump_major="$(major_from_pg_dump_version "$dump_raw")"
  echo "Server major version ${server_major}; pg_dump major version ${dump_major}"
  if ((10#$dump_major < 10#$server_major)); then
    fail "pg_dump major version ${dump_major} is older than the server major version ${server_major}. Install PostgreSQL client tools the same major version as the server, or newer, then retry. An older pg_dump cannot dump a newer server. On Windows, install PostgreSQL and put its bin directory on PATH. On macOS: brew install libpq. On Debian/Ubuntu: sudo apt-get install -y postgresql-client."
  fi
}

has_replica_role() {
  local file="$1"
  grep -i -q 'session_replication_role[[:space:]]*=[[:space:]]*replica' "$file"
}

file_bytes() {
  wc -c <"$1" | tr -d '[:space:]'
}

copy_blocks() {
  local count
  count="$(grep -c -E '^COPY[[:space:]]' "$1" || true)"
  printf '%s\n' "$count"
}

header_lines() {
  local stamp="$1"
  local schema_name="$2"
  local auth_name="$3"
  local data_name="$4"
  cat <<EOF
-- Bloodline Book database backup (${stamp}).
-- Restore into an EMPTY scratch Supabase project, in this order:
--   1. schema
--   2. auth data (auth.users and auth.identities)
--   3. public data
-- The schema file ends with DROP TRIGGER IF EXISTS and CREATE TRIGGER for every
-- non-internal trigger on auth.users whose function is in schema public, so the
-- invite trigger is restored with the schema. pg_dump --schema=public omits it.
-- The auth and public data files set session_replication_role to replica so
-- restore does not fire handle_new_farm or accept_farm_invites_for_user.
-- Those triggers insert into farm_members and break foreign keys on restore.
-- Commands (point RESTORE_DB_URL at the scratch project, never the live database):
--   psql "\$RESTORE_DB_URL" -v ON_ERROR_STOP=1 -f ${schema_name}
--   psql "\$RESTORE_DB_URL" -v ON_ERROR_STOP=1 -f ${auth_name}
--   psql "\$RESTORE_DB_URL" -v ON_ERROR_STOP=1 -f ${data_name}
-- Or: RESTORE_DB_URL=... BACKUP_DIR=... bash scripts/restore-db.sh ${stamp}
-- A restore does not recreate Supabase project settings, auth provider
-- settings, PowerSync config, API keys, or anything outside public plus
-- auth.users and auth.identities.
EOF
}

compose_dump_file() {
  local src="$1"
  local dest="$2"
  local kind="$3"
  local stamp="$4"
  local schema_name="$5"
  local auth_name="$6"
  local data_name="$7"
  local out add_replica=0

  if [[ ! -s "$src" ]]; then
    fail "Sanity check failed: pg_dump wrote an empty ${kind} file. Nothing was kept."
  fi

  if [[ "$kind" == "auth" || "$kind" == "data" ]]; then
    if ! has_replica_role "$src"; then
      add_replica=1
    fi
  fi

  out="$(mktemp "${dest%/*}/.bloodline-${kind}.XXXXXX")" || fail "Could not create a temporary file in BACKUP_DIR."
  track "$out"
  {
    if ((add_replica)); then
      printf '%s\n' 'SET session_replication_role = replica;'
      printf '\n'
    fi
    header_lines "$stamp" "$schema_name" "$auth_name" "$data_name"
    printf '\n'
    cat "$src"
  } >"$out"

  if [[ ! -s "$out" ]]; then
    fail "Sanity check failed: ${dest} is empty. Nothing was kept."
  fi
  if [[ "$kind" == "auth" ]]; then
    if ! grep -q 'COPY auth.users' "$out"; then
      fail "Sanity check failed: $(basename "$dest") does not contain 'COPY auth.users'. The auth dump is incomplete, so it was not kept."
    fi
  fi
  if [[ "$kind" == "data" ]]; then
    if ! grep -q 'COPY public.' "$out"; then
      fail "Sanity check failed: $(basename "$dest") does not contain 'COPY public.'. The data dump is incomplete, so it was not kept."
    fi
  fi
  if [[ "$kind" == "auth" || "$kind" == "data" ]]; then
    if ! has_replica_role "$out"; then
      fail "Sanity check failed: $(basename "$dest") is missing session_replication_role = replica. Nothing was kept."
    fi
  fi

  mv "$out" "$dest"
  track "$dest"
}

run_pg_dump() {
  local label="$1"
  shift
  if ! pg_dump "$SUPABASE_DB_URL" "$@"; then
    fail "pg_dump failed while writing the ${label} backup. Partial files were removed. The connection string was not printed."
  fi
}

append_auth_user_public_triggers() {
  local schema_file="$1"
  local sql raw line name def
  sql="$(cat <<'EOF'
SELECT t.tgname || E'\t' || pg_get_triggerdef(t.oid, false)
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace cn ON cn.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
JOIN pg_namespace pn ON pn.oid = p.pronamespace
WHERE cn.nspname = 'auth'
  AND c.relname = 'users'
  AND NOT t.tgisinternal
  AND pn.nspname = 'public'
ORDER BY t.tgname;
EOF
)"
  # search_path=pg_catalog makes pg_get_triggerdef schema-qualify public functions,
  # so CREATE TRIGGER still finds accept_farm_invites_for_user on restore.
  raw="$(PGOPTIONS="-c search_path=pg_catalog${PGOPTIONS:+ ${PGOPTIONS}}" \
    psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -Atc "$sql")" \
    || fail "Could not read triggers on auth.users. The connection string was not printed."
  raw="${raw//$'\r'/}"

  {
    printf '\n'
    printf '%s\n' '-- Non-internal triggers on auth.users whose function is in schema public.'
    printf '%s\n' '-- pg_dump --schema=public does not include these. Drop and create them'
    printf '%s\n' '-- with the schema so the invite trigger is restored.'
    if [[ -z "$raw" ]]; then
      printf '%s\n' '-- (none)'
    else
      while IFS= read -r line || [[ -n "$line" ]]; do
        [[ -z "$line" ]] && continue
        name="${line%%$'\t'*}"
        def="${line#*$'\t'}"
        if [[ ! "$name" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
          fail "Refusing to record an auth.users trigger whose name is not a plain identifier."
        fi
        if [[ "$def" == "$line" || -z "$def" ]]; then
          fail "pg_get_triggerdef returned nothing for auth.users trigger ${name}."
        fi
        def="${def%;}"
        printf 'DROP TRIGGER IF EXISTS %s ON auth.users;\n' "$name"
        printf '%s;\n' "$def"
      done <<< "$raw"
    fi
  } >>"$schema_file"

  if [[ "$raw" != *on_auth_user_created_accept_invites* ]]; then
    echo "WARNING: no on_auth_user_created_accept_invites trigger was appended to the schema file. Invite acceptance will not be restored with the schema." >&2
  fi
}

prune_keep_newest_sets() {
  local dir="$1"
  local keep="$2"
  local current="$3"
  local -a stamps=()
  local -a sorted=()
  local -a keepers=()
  local f base ts line i count k keep_this
  local nullglob_was=0

  if shopt -q nullglob; then
    nullglob_was=1
  fi
  shopt -s nullglob
  for f in "$dir"/bloodline-schema-*.sql "$dir"/bloodline-auth-*.sql "$dir"/bloodline-data-*.sql; do
    base="$(basename "$f")"
    if [[ "$base" =~ ^bloodline-(schema|auth|data)-([0-9]{8}T[0-9]{6}Z)\.sql$ ]]; then
      stamps+=("${BASH_REMATCH[2]}")
    fi
  done
  if ((nullglob_was == 0)); then
    shopt -u nullglob
  fi

  if ((${#stamps[@]} == 0)); then
    return 0
  fi

  while IFS= read -r line; do
    if [[ -n "$line" ]]; then
      sorted+=("$line")
    fi
  done < <(printf '%s\n' "${stamps[@]}" | sort -u)

  count="${#sorted[@]}"
  keepers+=("$current")
  for ((i = count - 1; i >= 0; i--)); do
    ts="${sorted[$i]}"
    if [[ "$ts" == "$current" ]]; then
      continue
    fi
    if ((${#keepers[@]} >= keep)); then
      break
    fi
    keepers+=("$ts")
  done

  for ts in "${sorted[@]}"; do
    keep_this=0
    for k in "${keepers[@]}"; do
      if [[ "$k" == "$ts" ]]; then
        keep_this=1
        break
      fi
    done
    if ((keep_this == 0)); then
      rm -f -- \
        "$dir/bloodline-schema-${ts}.sql" \
        "$dir/bloodline-auth-${ts}.sql" \
        "$dir/bloodline-data-${ts}.sql"
      echo "Removed old backup set ${ts}"
    fi
  done
}

chmod_private() {
  local f base
  for f in "$@"; do
    base="$(basename "$f")"
    if ! chmod 600 "$f" 2>/dev/null; then
      echo "WARNING: could not chmod 600 ${base}. Restrict access to this file yourself." >&2
    fi
  done
}

report_file() {
  local file="$1"
  local bytes copies
  bytes="$(file_bytes "$file")"
  copies="$(copy_blocks "$file")"
  printf '%s bytes, %s COPY blocks, %s\n' "$bytes" "$copies" "$file"
}

next_stamp() {
  local dir="$1"
  local stamp
  stamp="$(date -u +%Y%m%dT%H%M%SZ)" || fail "Could not format the backup timestamp."
  if [[ ! "$stamp" =~ ^[0-9]{8}T[0-9]{6}Z$ ]]; then
    fail "Could not format the backup timestamp."
  fi
  while [[ -e "$dir/bloodline-schema-${stamp}.sql" \
    || -e "$dir/bloodline-auth-${stamp}.sql" \
    || -e "$dir/bloodline-data-${stamp}.sql" ]]; do
    sleep 1
    stamp="$(date -u +%Y%m%dT%H%M%SZ)" || fail "Could not format the backup timestamp."
  done
  printf '%s\n' "$stamp"
}

main() {
  local backup_abs stamp
  local schema_tmp auth_tmp data_tmp
  local schema_final auth_final data_final
  local schema_name auth_name data_name
  local finished

  trap on_exit EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM

  if (($# != 0)); then
    usage
    fail "This script does not take arguments."
  fi

  if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
    usage
    fail "SUPABASE_DB_URL is not set. Export the Postgres connection string in the shell. Do not read it from the repo or from .env."
  fi
  if [[ -z "${BACKUP_DIR:-}" ]]; then
    usage
    fail "BACKUP_DIR is not set. Choose a directory outside this git repository."
  fi

  require_client_tools
  umask 077
  RESOLVED_BACKUP_DIR=""
  assert_backup_outside_repo
  backup_abs="$RESOLVED_BACKUP_DIR"
  case "$backup_abs" in
    /* | [A-Za-z]:/* | [A-Za-z]:\\*) ;;
    *) fail "Could not resolve BACKUP_DIR to an absolute path." ;;
  esac
  mkdir -p -- "$backup_abs"
  assert_dump_new_enough

  stamp="$(next_stamp "$backup_abs")" || exit 1
  schema_name="bloodline-schema-${stamp}.sql"
  auth_name="bloodline-auth-${stamp}.sql"
  data_name="bloodline-data-${stamp}.sql"
  schema_final="${backup_abs}/${schema_name}"
  auth_final="${backup_abs}/${auth_name}"
  data_final="${backup_abs}/${data_name}"

  schema_tmp="$(mktemp "${backup_abs}/.bloodline-schema.XXXXXX")" || fail "Could not create a temporary file in BACKUP_DIR."
  auth_tmp="$(mktemp "${backup_abs}/.bloodline-auth.XXXXXX")" || fail "Could not create a temporary file in BACKUP_DIR."
  data_tmp="$(mktemp "${backup_abs}/.bloodline-data.XXXXXX")" || fail "Could not create a temporary file in BACKUP_DIR."
  track "$schema_tmp"
  track "$auth_tmp"
  track "$data_tmp"

  echo "Dumping public schema, auth data, and public data with pg_dump"
  run_pg_dump "schema" \
    --schema-only --schema=public --no-owner --no-privileges \
    --file "$schema_tmp"
  run_pg_dump "auth" \
    --data-only --no-owner --no-privileges \
    -t auth.users -t auth.identities \
    --file "$auth_tmp"
  run_pg_dump "public data" \
    --data-only --schema=public --no-owner --no-privileges \
    --file "$data_tmp"

  append_auth_user_public_triggers "$schema_tmp"

  compose_dump_file "$schema_tmp" "$schema_final" schema "$stamp" \
    "$schema_name" "$auth_name" "$data_name"
  compose_dump_file "$auth_tmp" "$auth_final" auth "$stamp" \
    "$schema_name" "$auth_name" "$data_name"
  compose_dump_file "$data_tmp" "$data_final" data "$stamp" \
    "$schema_name" "$auth_name" "$data_name"

  rm -f -- "$schema_tmp" "$auth_tmp" "$data_tmp"

  for finished in "$schema_final" "$auth_final" "$data_final"; do
    if [[ ! -s "$finished" ]]; then
      fail "Sanity check failed: $(basename "$finished") is empty. Nothing was kept."
    fi
  done
  if ! grep -q 'COPY auth.users' "$auth_final"; then
    fail "Sanity check failed: ${auth_name} does not contain 'COPY auth.users'. Nothing was kept."
  fi
  if ! grep -q 'COPY public.' "$data_final"; then
    fail "Sanity check failed: ${data_name} does not contain 'COPY public.'. Nothing was kept."
  fi
  if ! grep -q 'Non-internal triggers on auth.users whose function is in schema public.' "$schema_final"; then
    fail "Sanity check failed: ${schema_name} is missing the auth.users trigger section. Nothing was kept."
  fi

  chmod_private "$schema_final" "$auth_final" "$data_final"
  SUCCESS=1

  prune_keep_newest_sets "$backup_abs" 8 "$stamp"

  echo "Wrote:"
  report_file "$schema_final"
  report_file "$auth_final"
  report_file "$data_final"
  echo "WARNING: ${auth_name} contains emails and password hashes." >&2
  echo "Keep it private. Do not commit it, and do not email it." >&2
  echo "Restore into an empty scratch database (schema, then auth data, then public data):"
  printf '  psql "%sRESTORE_DB_URL" -v ON_ERROR_STOP=1 -f %s\n' '$' "$schema_name"
  printf '  psql "%sRESTORE_DB_URL" -v ON_ERROR_STOP=1 -f %s\n' '$' "$auth_name"
  printf '  psql "%sRESTORE_DB_URL" -v ON_ERROR_STOP=1 -f %s\n' '$' "$data_name"
  printf '  bash scripts/restore-db.sh %s\n' "$stamp"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
