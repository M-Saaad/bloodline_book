#!/usr/bin/env bash
# Download the newest encrypted backup set from B2 (via rclone), decrypt,
# restore into RESTORE_DB_URL, and compare live vs restored row counts for
# public tables plus auth.users and auth.identities. Fails on any mismatch or
# when restored farm_members.user_id values are missing from auth.users.
#
# Shell environment only (never .env, never this repo):
#   SUPABASE_DB_URL       Live project (row counts only; never restored into)
#   RESTORE_DB_URL        Scratch project (must differ from live)
#   BACKUP_DIR            Outside the git repo (decrypted SQL lands here briefly)
#   BACKUP_PASSPHRASE     Decrypts remote blobs
#   BACKUP_REMOTE_PATH    rclone path, e.g. offsite:bucket/bloodline
#   RCLONE_CONFIG_OFFSITE_*   rclone remote "offsite"
#
# Usage:
#   bash scripts/restore-test-offsite.sh

set -euo pipefail
shopt -s inherit_errexit 2>/dev/null || true

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE_NAME="offsite"

fail() {
  echo "ERROR: $*" >&2
  exit 1
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

decrypt_tool_for_suffix() {
  local suffix="$1"
  case "$suffix" in
    .age)
      if command -v age >/dev/null 2>&1; then
        printf '%s\n' age
        return 0
      fi
      ;;
    .enc)
      if command -v openssl >/dev/null 2>&1; then
        printf '%s\n' openssl
        return 0
      fi
      ;;
    *)
      fail "Unknown encryption suffix ${suffix}."
      ;;
  esac
  fail "Need the tool that matches suffix ${suffix} (.age needs age, .enc needs openssl)."
}

remote_newest_complete_stamp() {
  local remote_path="$1"
  local -A have_schema=()
  local -A have_auth=()
  local -A have_data=()
  local line base ts kind suffix
  local best=""

  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    base="${line##*/}"
    if [[ "$base" =~ ^bloodline-(schema|auth|data)-([0-9]{8}T[0-9]{6}Z)\.sql(\.age|\.enc)$ ]]; then
      kind="${BASH_REMATCH[1]}"
      ts="${BASH_REMATCH[2]}"
      case "$kind" in
        schema) have_schema["$ts"]=1 ;;
        auth) have_auth["$ts"]=1 ;;
        data) have_data["$ts"]=1 ;;
      esac
    fi
  done < <(rclone lsf "$remote_path" --files-only 2>/dev/null || true)

  for ts in "${!have_schema[@]}"; do
    if [[ -n "${have_auth[$ts]:-}" && -n "${have_data[$ts]:-}" ]]; then
      if [[ -z "$best" || "$ts" > "$best" ]]; then
        best="$ts"
      fi
    fi
  done

  if [[ -z "$best" ]]; then
    fail "No complete encrypted backup set found on the remote."
  fi
  printf '%s\n' "$best"
}

detect_enc_suffix() {
  local remote_path="$1"
  local stamp="$2"
  if rclone lsf "$remote_path" --files-only --include "bloodline-schema-${stamp}.sql.age" 2>/dev/null | grep -q .; then
    printf '%s\n' .age
    return 0
  fi
  if rclone lsf "$remote_path" --files-only --include "bloodline-schema-${stamp}.sql.enc" 2>/dev/null | grep -q .; then
    printf '%s\n' .enc
    return 0
  fi
  fail "Could not detect encryption suffix (.age or .enc) for set ${stamp}."
}

decrypt_file() {
  local enc="$1"
  local plain="$2"
  local tool="$3"
  case "$tool" in
    age)
      AGE_PASSPHRASE="$BACKUP_PASSPHRASE" age -d -p -o "$plain" "$enc" \
        || fail "age decryption failed for $(basename "$enc")."
      ;;
    openssl)
      openssl enc -d -aes-256-cbc -pbkdf2 \
        -pass "env:BACKUP_PASSPHRASE" \
        -in "$enc" -out "$plain" \
        || fail "openssl decryption failed for $(basename "$enc")."
      ;;
    *)
      fail "Unknown decrypt tool."
      ;;
  esac
}

list_public_tables() {
  local url="$1"
  psql "$url" -X -v ON_ERROR_STOP=1 -Atc \
    "SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY c.relname"
}

count_public_tables_tsv() {
  local url="$1"
  local label="$2"
  local tables table count
  tables="$(list_public_tables "$url")" || fail "Could not list public tables for ${label}."
  while IFS= read -r table || [[ -n "$table" ]]; do
    table="${table//$'\r'/}"
    [[ -z "$table" ]] && continue
    if [[ ! "$table" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
      fail "Unexpected public table name while counting ${label} rows."
    fi
    count="$(psql "$url" -X -v ON_ERROR_STOP=1 -Atc "SELECT count(*) FROM public.\"${table}\"")" \
      || fail "Could not count public.${table} for ${label}."
    printf '%s\t%s\n' "$table" "$count"
  done <<< "$tables"
}

count_auth_tables_tsv() {
  local url="$1"
  local label="$2"
  local table count
  for table in users identities; do
    count="$(psql "$url" -X -v ON_ERROR_STOP=1 -Atc "SELECT count(*) FROM auth.\"${table}\"")" \
      || fail "Could not count auth.${table} for ${label}."
    if [[ ! "$count" =~ ^[0-9]+$ ]]; then
      fail "Expected a numeric row count for auth.${table} (${label})."
    fi
    printf 'auth.%s\t%s\n' "$table" "$count"
  done
}

collect_row_counts_tsv() {
  local url="$1"
  local label="$2"
  count_public_tables_tsv "$url" "$label"
  count_auth_tables_tsv "$url" "$label"
}

print_comparison() {
  local live_file="$1"
  local restored_file="$2"
  local -A live=()
  local -A restored=()
  local table

  while IFS=$'\t' read -r table count; do
    [[ -z "$table" ]] && continue
    live["$table"]="$count"
  done <"$live_file"

  while IFS=$'\t' read -r table count; do
    [[ -z "$table" ]] && continue
    restored["$table"]="$count"
  done <"$restored_file"

  printf '%s\n' "table	live	restored"
  for table in $(printf '%s\n' "${!live[@]}" "${!restored[@]}" | sort -u); do
    printf '%s\t%s\t%s\n' "$table" "${live[$table]:-0}" "${restored[$table]:-0}"
  done
}

verify_counts_match() {
  local live_file="$1"
  local restored_file="$2"
  local -A live=()
  local -A restored=()
  local table live_count restored_count
  local -a mismatches=()

  while IFS=$'\t' read -r table count; do
    [[ -z "$table" ]] && continue
    live["$table"]="$count"
  done <"$live_file"

  while IFS=$'\t' read -r table count; do
    [[ -z "$table" ]] && continue
    restored["$table"]="$count"
  done <"$restored_file"

  for table in $(printf '%s\n' "${!live[@]}" "${!restored[@]}" | sort -u); do
    live_count="${live[$table]:-0}"
    restored_count="${restored[$table]:-0}"
    if [[ "$live_count" != "$restored_count" ]]; then
      mismatches+=("${table} (live=${live_count}, restored=${restored_count})")
    fi
  done

  if ((${#mismatches[@]} > 0)); then
    fail "Row count mismatch between live and restored: ${mismatches[*]}"
  fi
}

count_farm_members_missing_auth_users() {
  local url="$1"
  local count
  count="$(psql "$url" -X -v ON_ERROR_STOP=1 -Atc \
    "SELECT count(*) FROM public.farm_members fm WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = fm.user_id)")" \
    || fail "Could not check farm_members.user_id against auth.users on restored database."
  count="${count//$'\r'/}"
  if [[ ! "$count" =~ ^[0-9]+$ ]]; then
    fail "Expected a numeric count of farm_members rows missing auth.users."
  fi
  printf '%s\n' "$count"
}

main() {
  local backup_abs stamp suffix tool enc_schema enc_auth enc_data
  local plain_schema plain_auth plain_data restore_host
  local live_counts restored_counts
  local start_ts end_ts elapsed

  if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
    fail "SUPABASE_DB_URL is not set."
  fi
  if [[ -z "${RESTORE_DB_URL:-}" ]]; then
    fail "RESTORE_DB_URL is not set."
  fi
  if [[ -z "${BACKUP_DIR:-}" ]]; then
    fail "BACKUP_DIR is not set."
  fi
  if [[ -z "${BACKUP_PASSPHRASE:-}" ]]; then
    fail "BACKUP_PASSPHRASE is not set."
  fi
  if [[ -z "${BACKUP_REMOTE_PATH:-}" ]]; then
    fail "BACKUP_REMOTE_PATH is not set."
  fi
  if [[ -z "${RCLONE_CONFIG_OFFSITE_TYPE:-}" ]]; then
    fail "RCLONE_CONFIG_OFFSITE_TYPE is not set."
  fi
  if [[ "$BACKUP_REMOTE_PATH" != "${REMOTE_NAME}:"* ]]; then
    fail "BACKUP_REMOTE_PATH must start with ${REMOTE_NAME}:"
  fi
  if ! command -v rclone >/dev/null 2>&1; then
    fail "rclone is not installed."
  fi

  umask 077
  mkdir -p -- "$BACKUP_DIR"
  backup_abs="$(cd "$BACKUP_DIR" && pwd -P)" || fail "Cannot resolve BACKUP_DIR."

  stamp="$(remote_newest_complete_stamp "$BACKUP_REMOTE_PATH")"
  suffix="$(detect_enc_suffix "$BACKUP_REMOTE_PATH" "$stamp")"
  tool="$(decrypt_tool_for_suffix "$suffix")"

  echo "Newest remote backup set: ${stamp} (${tool}${suffix})"

  enc_schema="${backup_abs}/bloodline-schema-${stamp}.sql${suffix}"
  enc_auth="${backup_abs}/bloodline-auth-${stamp}.sql${suffix}"
  enc_data="${backup_abs}/bloodline-data-${stamp}.sql${suffix}"

  rclone copy "$BACKUP_REMOTE_PATH" "$backup_abs" \
    --include "bloodline-schema-${stamp}.sql${suffix}" \
    --include "bloodline-auth-${stamp}.sql${suffix}" \
    --include "bloodline-data-${stamp}.sql${suffix}" \
    || fail "rclone copy failed."

  plain_schema="${backup_abs}/bloodline-schema-${stamp}.sql"
  plain_auth="${backup_abs}/bloodline-auth-${stamp}.sql"
  plain_data="${backup_abs}/bloodline-data-${stamp}.sql"

  decrypt_file "$enc_schema" "$plain_schema" "$tool"
  decrypt_file "$enc_auth" "$plain_auth" "$tool"
  decrypt_file "$enc_data" "$plain_data" "$tool"
  chmod 600 "$plain_schema" "$plain_auth" "$plain_data" 2>/dev/null || true
  rm -f -- "$enc_schema" "$enc_auth" "$enc_data"

  live_counts="$(mktemp)"
  restored_counts="$(mktemp)"
  trap 'rm -f -- "$live_counts" "$restored_counts"' EXIT

  echo "Collecting live row counts (read-only)."
  collect_row_counts_tsv "$SUPABASE_DB_URL" live >"$live_counts"

  restore_host="$(db_host "$RESTORE_DB_URL")"

  start_ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  SECONDS=0
  printf '%s\n' "$restore_host" | bash "$ROOT/scripts/restore-db.sh" "$stamp" \
    || fail "restore-db.sh failed."
  end_ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  elapsed="${SECONDS}"

  echo "Collecting restored row counts."
  collect_row_counts_tsv "$RESTORE_DB_URL" restored >"$restored_counts"

  echo "Restore window: ${start_ts} .. ${end_ts} (${elapsed}s UTC)"
  print_comparison "$live_counts" "$restored_counts"
  verify_counts_match "$live_counts" "$restored_counts"

  missing_users="$(count_farm_members_missing_auth_users "$RESTORE_DB_URL")"
  echo "farm_members.user_id missing from auth.users (restored DB): ${missing_users}"
  if [[ "$missing_users" != "0" ]]; then
    fail "Restored farm_members references ${missing_users} user_id value(s) not present in auth.users."
  fi

  rm -f -- "$plain_schema" "$plain_auth" "$plain_data"
  echo "Removed local plaintext SQL for set ${stamp}."

  rm -f -- "$live_counts" "$restored_counts"
  trap - EXIT
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
