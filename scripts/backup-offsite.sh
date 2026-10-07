#!/usr/bin/env bash
# Run scripts/backup-db.sh, encrypt the new backup set, upload off-site with rclone,
# verify sizes, prune old remote sets, and remove local plaintext SQL files.
#
# Shell environment only (never .env, never this repo):
#   SUPABASE_DB_URL      Postgres URI (required unless BACKUP_OFFSITE_SKIP_DUMP=yes)
#   BACKUP_DIR           Local directory for dumps (must be outside this git repo)
#   BACKUP_PASSPHRASE    Encrypts every backup file (never printed or written to disk)
#   BACKUP_REMOTE_PATH   rclone destination, e.g. offsite:my-bucket/bloodline
#
# rclone remote "offsite" is configured only via RCLONE_CONFIG_OFFSITE_* variables.
# No rclone config file in the repo.
#
# Optional:
#   BACKUP_OFFSITE_SKIP_DUMP=yes   Use the newest complete set in BACKUP_DIR (tests only)
#   BACKUP_OFFSITE_STAMP=...        With SKIP_DUMP, upload this set instead of newest
#
# Usage:
#   export BACKUP_PASSPHRASE='...'
#   export BACKUP_REMOTE_PATH='offsite:my-bucket/bloodline'
#   export RCLONE_CONFIG_OFFSITE_TYPE=s3
#   export RCLONE_CONFIG_OFFSITE_PROVIDER=Cloudflare
#   ... other RCLONE_CONFIG_OFFSITE_* ...
#   export SUPABASE_DB_URL='postgresql://...'
#   export BACKUP_DIR="$HOME/bloodline-backups"
#   bash scripts/backup-offsite.sh

set -euo pipefail
shopt -s inherit_errexit 2>/dev/null || true

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE_NAME="offsite"
REMOTE_KEEP_SETS=8

ENC_SUFFIX=""
ENC_TOOL=""

usage() {
  cat >&2 <<'EOF'
Usage: BACKUP_PASSPHRASE=... BACKUP_REMOTE_PATH=... BACKUP_DIR=... bash scripts/backup-offsite.sh
Also set SUPABASE_DB_URL unless BACKUP_OFFSITE_SKIP_DUMP=yes.
Configure the offsite rclone remote with RCLONE_CONFIG_OFFSITE_* (no config file in the repo).
BACKUP_REMOTE_PATH looks like offsite:bucket-name/prefix
BACKUP_DIR must be outside this git repository.
EOF
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
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

require_rclone_remote() {
  if [[ -z "${RCLONE_CONFIG_OFFSITE_TYPE:-}" ]]; then
    fail "Remote ${REMOTE_NAME} is not configured. Set RCLONE_CONFIG_OFFSITE_TYPE (and the other RCLONE_CONFIG_OFFSITE_* variables). No rclone config file belongs in this repo."
  fi
  if ! command -v rclone >/dev/null 2>&1; then
    fail "rclone is not installed. Install rclone and retry."
  fi
}

assert_remote_path() {
  local path="$1"
  if [[ "$path" != "${REMOTE_NAME}:"* ]]; then
    fail "BACKUP_REMOTE_PATH must start with ${REMOTE_NAME}: (for example ${REMOTE_NAME}:my-bucket/bloodline)."
  fi
}

pick_encrypt_tool() {
  if command -v age >/dev/null 2>&1; then
    ENC_TOOL="age"
    ENC_SUFFIX=".age"
    return 0
  fi
  if command -v openssl >/dev/null 2>&1; then
    ENC_TOOL="openssl"
    ENC_SUFFIX=".enc"
    return 0
  fi
  fail "Need age or openssl to encrypt backups."
}

encrypt_file() {
  local plain="$1"
  local enc="$2"
  case "$ENC_TOOL" in
    age)
      AGE_PASSPHRASE="$BACKUP_PASSPHRASE" age -e -p -o "$enc" "$plain" \
        || fail "age encryption failed for $(basename "$plain")."
      ;;
    openssl)
      openssl enc -aes-256-cbc -pbkdf2 -salt \
        -pass "env:BACKUP_PASSPHRASE" \
        -in "$plain" -out "$enc" \
        || fail "openssl encryption failed for $(basename "$plain")."
      ;;
    *)
      fail "Unknown encryption tool."
      ;;
  esac
}

decrypt_hint() {
  case "$ENC_TOOL" in
    age)
      printf '%s\n' "Decrypt with: AGE_PASSPHRASE='...' age -d -p -o PLAIN FILE.age"
      ;;
    openssl)
      printf '%s\n' "Decrypt with: openssl enc -d -aes-256-cbc -pbkdf2 -in FILE.enc -out PLAIN -pass env:BACKUP_PASSPHRASE"
      ;;
  esac
}

file_bytes() {
  wc -c <"$1" | tr -d '[:space:]'
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

remote_list_stamps() {
  local remote_path="$1"
  local -a stamps=()
  local line base ts kind
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    base="${line##*/}"
    if [[ "$base" =~ ^bloodline-(schema|auth|data)-([0-9]{8}T[0-9]{6}Z)\.sql(\.age|\.enc)$ ]]; then
      ts="${BASH_REMATCH[2]}"
      stamps+=("$ts")
    fi
  done < <(rclone lsf "$remote_path" --files-only 2>/dev/null || true)
  if ((${#stamps[@]} == 0)); then
    return 0
  fi
  printf '%s\n' "${stamps[@]}" | sort -u
}

prune_remote_sets() {
  local remote_path="$1"
  local keep="$2"
  local current="$3"
  local -a sorted=()
  local -a keepers=()
  local line ts count i k keep_this

  while IFS= read -r line; do
    if [[ -n "$line" ]]; then
      sorted+=("$line")
    fi
  done < <(remote_list_stamps "$remote_path" | sort)

  count="${#sorted[@]}"
  if ((count == 0)); then
    return 0
  fi

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
      rclone delete "$remote_path" \
        --include "bloodline-schema-${ts}.sql.age" \
        --include "bloodline-schema-${ts}.sql.enc" \
        --include "bloodline-auth-${ts}.sql.age" \
        --include "bloodline-auth-${ts}.sql.enc" \
        --include "bloodline-data-${ts}.sql.age" \
        --include "bloodline-data-${ts}.sql.enc" \
        || fail "rclone delete failed while pruning remote backup set ${ts}."
      echo "Removed remote backup set ${ts}"
    fi
  done
}

verify_remote_sizes() {
  local remote_path="$1"
  shift
  local enc_file base local_bytes remote_bytes remote_line
  for enc_file in "$@"; do
    base="$(basename "$enc_file")"
    local_bytes="$(file_bytes "$enc_file")"
    remote_line="$(rclone lsl "$remote_path/$base" 2>/dev/null | head -n 1 || true)"
    if [[ -z "$remote_line" ]]; then
      fail "Remote verify failed: ${base} is missing under ${remote_path}."
    fi
    remote_bytes="$(awk '{print $1}' <<<"$remote_line")"
    if [[ -z "$remote_bytes" || "$remote_bytes" != "$local_bytes" ]]; then
      fail "Remote verify failed: size mismatch for ${base} (local ${local_bytes} bytes, remote ${remote_bytes:-unknown})."
    fi
    echo "Verified remote ${base} (${local_bytes} bytes)"
  done
}

main() {
  local backup_abs stamp skip_dump
  local schema_plain auth_plain data_plain
  local schema_enc auth_enc data_enc
  local -a enc_files=()

  if (($# != 0)); then
    usage
    fail "This script does not take arguments."
  fi

  if [[ -z "${BACKUP_PASSPHRASE:-}" ]]; then
    usage
    fail "BACKUP_PASSPHRASE is not set. Export a strong passphrase in the shell. It is never printed or written to disk."
  fi
  if [[ -z "${BACKUP_DIR:-}" ]]; then
    usage
    fail "BACKUP_DIR is not set. Choose a directory outside this git repository."
  fi
  if [[ -z "${BACKUP_REMOTE_PATH:-}" ]]; then
    usage
    fail "BACKUP_REMOTE_PATH is not set (for example offsite:my-bucket/bloodline)."
  fi

  require_rclone_remote
  assert_remote_path "$BACKUP_REMOTE_PATH"
  pick_encrypt_tool

  umask 077
  RESOLVED_BACKUP_DIR=""
  assert_backup_outside_repo
  backup_abs="$RESOLVED_BACKUP_DIR"
  mkdir -p -- "$backup_abs"

  skip_dump="${BACKUP_OFFSITE_SKIP_DUMP:-}"
  if [[ "$skip_dump" == "yes" ]]; then
    echo "BACKUP_OFFSITE_SKIP_DUMP=yes: not running scripts/backup-db.sh"
  else
    if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
      usage
      fail "SUPABASE_DB_URL is not set. Export the Postgres connection string in the shell, or set BACKUP_OFFSITE_SKIP_DUMP=yes for tests."
    fi
    bash "$ROOT/scripts/backup-db.sh"
  fi

  if [[ -n "${BACKUP_OFFSITE_STAMP:-}" ]]; then
    stamp="$BACKUP_OFFSITE_STAMP"
    if [[ ! "$stamp" =~ ^[0-9]{8}T[0-9]{6}Z$ ]]; then
      fail "BACKUP_OFFSITE_STAMP must look like 20260101T120000Z."
    fi
  else
    stamp="$(newest_complete_stamp "$backup_abs")" || exit 1
  fi

  schema_plain="${backup_abs}/bloodline-schema-${stamp}.sql"
  auth_plain="${backup_abs}/bloodline-auth-${stamp}.sql"
  data_plain="${backup_abs}/bloodline-data-${stamp}.sql"
  for f in "$schema_plain" "$auth_plain" "$data_plain"; do
    if [[ ! -s "$f" ]]; then
      fail "Backup set ${stamp} is incomplete or empty: $(basename "$f")"
    fi
  done

  schema_enc="${schema_plain}${ENC_SUFFIX}"
  auth_enc="${auth_plain}${ENC_SUFFIX}"
  data_enc="${data_plain}${ENC_SUFFIX}"
  enc_files=("$schema_enc" "$auth_enc" "$data_enc")

  echo "Encrypting backup set ${stamp} with ${ENC_TOOL}"
  encrypt_file "$schema_plain" "$schema_enc"
  encrypt_file "$auth_plain" "$auth_enc"
  encrypt_file "$data_plain" "$data_enc"
  chmod 600 "$schema_enc" "$auth_enc" "$data_enc" 2>/dev/null || true

  echo "Uploading to ${BACKUP_REMOTE_PATH}"
  rclone copy "$backup_abs" "$BACKUP_REMOTE_PATH" \
    --include "bloodline-schema-${stamp}.sql${ENC_SUFFIX}" \
    --include "bloodline-auth-${stamp}.sql${ENC_SUFFIX}" \
    --include "bloodline-data-${stamp}.sql${ENC_SUFFIX}" \
    || fail "rclone copy failed."

  verify_remote_sizes "$BACKUP_REMOTE_PATH" "${enc_files[@]}"

  prune_remote_sets "$BACKUP_REMOTE_PATH" "$REMOTE_KEEP_SETS" "$stamp"

  rm -f -- "$schema_plain" "$auth_plain" "$data_plain"
  echo "Removed local plaintext SQL for set ${stamp}"

  echo "Off-site backup complete for set ${stamp} (${ENC_TOOL}, suffix ${ENC_SUFFIX})."
  decrypt_hint >&2
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
