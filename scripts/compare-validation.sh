#!/usr/bin/env bash
# Compare two validation matrices written by scripts/db-validation-matrix.sh.
#
# Usage:
#   bash scripts/compare-validation.sh before.tsv after.tsv
#
# Lines that start with '#' (the host and timestamp header) are ignored.
# Exit 0 only when the remaining lines are identical. Otherwise print a table
# of changed, removed, and added rows and exit 1.
#
# Row keys match db-validation-matrix.sh:
#   table, columns          key is kind + schema + name; the rest is the value
#   publication             key is kind + publication name
#   trigger_name            the whole row is the key (the trigger name)
#   other count rows        key is kind + schema; the last field is the value

set -euo pipefail

BEFORE_BODY=""
AFTER_BODY=""

usage() {
  cat >&2 <<'EOF'
Usage: bash scripts/compare-validation.sh BEFORE AFTER
Exit 0 when the matrices match (ignoring lines that start with '#').
Exit 1 when they differ, or when the arguments are wrong.
EOF
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

cleanup() {
  if [[ -n "$BEFORE_BODY" ]]; then
    rm -f -- "$BEFORE_BODY"
  fi
  if [[ -n "$AFTER_BODY" ]]; then
    rm -f -- "$AFTER_BODY"
  fi
}

strip_file() {
  local src="$1"
  local dest="$2"
  local line
  : >"$dest"
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line//$'\r'/}"
    [[ "$line" == \#* ]] && continue
    [[ -z "$line" ]] && continue
    printf '%s\n' "$line" >>"$dest"
  done <"$src"
}

row_key() {
  local line="$1"
  local kind rest second third
  kind="${line%%$'\t'*}"
  case "$kind" in
    table | columns)
      rest="${line#*$'\t'}"
      second="${rest%%$'\t'*}"
      rest="${rest#*$'\t'}"
      third="${rest%%$'\t'*}"
      printf '%s\t%s\t%s\n' "$kind" "$second" "$third"
      ;;
    publication)
      rest="${line#*$'\t'}"
      second="${rest%%$'\t'*}"
      printf '%s\t%s\n' "$kind" "$second"
      ;;
    trigger_name)
      printf '%s\n' "$line"
      ;;
    *)
      rest="${line#*$'\t'}"
      second="${rest%%$'\t'*}"
      printf '%s\t%s\n' "$kind" "$second"
      ;;
  esac
}

row_value() {
  local line="$1"
  local kind rest
  kind="${line%%$'\t'*}"
  case "$kind" in
    trigger_name)
      printf 'present\n'
      ;;
    table | columns)
      rest="${line#*$'\t'}"
      rest="${rest#*$'\t'}"
      rest="${rest#*$'\t'}"
      printf '%s\n' "${rest//$'\t'/ }"
      ;;
    publication)
      rest="${line#*$'\t'}"
      rest="${rest#*$'\t'}"
      printf '%s\n' "${rest//$'\t'/ }"
      ;;
    *)
      rest="${line#*$'\t'}"
      rest="${rest#*$'\t'}"
      printf '%s\n' "${rest//$'\t'/ }"
      ;;
  esac
}

display_key() {
  local key="$1"
  printf '%s\n' "${key//$'\t'/ }"
}

load_rows() {
  local file="$1"
  local label="$2"
  local line key
  declare -gA "$3"
  local -n dest="$3"
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" ]] && continue
    key="$(row_key "$line")"
    if [[ -n "${dest[$key]+x}" ]]; then
      fail "Duplicate matrix key in the ${label} file: $(display_key "$key")"
    fi
    dest["$key"]="$line"
  done <"$file"
}

main() {
  local before after key key_disp
  local -a keys=()
  local diffs=0
  local before_val after_val status_word

  if [[ $# -ne 2 ]]; then
    usage
    fail "Pass the before file and the after file."
  fi
  before="$1"
  after="$2"
  if [[ ! -f "$before" ]]; then
    fail "Before file does not exist."
  fi
  if [[ ! -f "$after" ]]; then
    fail "After file does not exist."
  fi

  trap cleanup EXIT
  BEFORE_BODY="$(mktemp)" || fail "Could not create a temporary file."
  AFTER_BODY="$(mktemp)" || fail "Could not create a temporary file."
  strip_file "$before" "$BEFORE_BODY"
  strip_file "$after" "$AFTER_BODY"

  if cmp -s -- "$BEFORE_BODY" "$AFTER_BODY"; then
    echo "Validation matrices match."
    exit 0
  fi

  declare -gA BEFORE_MAP=()
  declare -gA AFTER_MAP=()
  load_rows "$BEFORE_BODY" "before" BEFORE_MAP
  load_rows "$AFTER_BODY" "after" AFTER_MAP

  while IFS= read -r key || [[ -n "$key" ]]; do
    [[ -z "$key" ]] && continue
    keys+=("$key")
  done < <(printf '%s\n' "${!BEFORE_MAP[@]}" "${!AFTER_MAP[@]}" | LC_ALL=C sort -u)

  for key in "${keys[@]}"; do
    if [[ -n "${BEFORE_MAP[$key]+x}" && -n "${AFTER_MAP[$key]+x}" ]]; then
      if [[ "${BEFORE_MAP[$key]}" == "${AFTER_MAP[$key]}" ]]; then
        continue
      fi
      status_word="changed"
      before_val="$(row_value "${BEFORE_MAP[$key]}")"
      after_val="$(row_value "${AFTER_MAP[$key]}")"
    elif [[ -n "${BEFORE_MAP[$key]+x}" ]]; then
      status_word="only before"
      before_val="$(row_value "${BEFORE_MAP[$key]}")"
      after_val=""
    else
      status_word="only after"
      before_val=""
      after_val="$(row_value "${AFTER_MAP[$key]}")"
    fi
    if ((diffs == 0)); then
      echo "Validation matrices differ."
      echo
      printf '%-12s  %-48s  %-40s  %s\n' "status" "key" "before" "after"
    fi
    diffs=$((diffs + 1))
    key_disp="$(display_key "$key")"
    printf '%-12s  %-48s  %-40s  %s\n' "$status_word" "$key_disp" "$before_val" "$after_val"
  done

  if ((diffs == 0)); then
    echo "Validation matrices differ."
    echo "The rows match but their order does not."
  fi
  exit 1
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
