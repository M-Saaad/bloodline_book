#!/usr/bin/env bash
# Stub tests for restore guards and the validation matrix tools.
# Nothing here connects to a database. psql is a local stub.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SECRET="super-secret-password"
URL="postgresql://postgres:${SECRET}@db.example.test:5432/postgres"
STAMP="20260101T000000Z"
TMP="$(mktemp -d)"
STATUS=0
OUT=""

cleanup() {
  rm -rf -- "$TMP"
}
trap cleanup EXIT

fail() {
  local text="$*"
  text="${text//"$SECRET"/***}"
  echo "FAIL: ${text}" >&2
  if [[ -n "${OUT:-}" ]]; then
    local shown="${OUT//"$SECRET"/***}"
    echo "--- output ---" >&2
    printf '%s\n' "$shown" >&2
  fi
  if [[ -f "${PSQL_LOG:-}" ]]; then
    local log
    log="$(cat "$PSQL_LOG")"
    log="${log//"$SECRET"/***}"
    echo "--- psql log ---" >&2
    printf '%s\n' "$log" >&2
  fi
  exit 1
}

assert_eq() {
  local got="$1"
  local want="$2"
  local label="$3"
  if [[ "$got" != "$want" ]]; then
    fail "${label}: expected ${want}, got ${got}"
  fi
}

assert_grep() {
  local pattern="$1"
  local label="$2"
  if ! grep -q -E -- "$pattern" <<<"$OUT"; then
    fail "${label}: output missing /${pattern}/"
  fi
}

assert_no_secret() {
  local label="$1"
  if [[ "$OUT" == *"$SECRET"* ]]; then
    fail "${label}: output contained the database password"
  fi
  if [[ "$OUT" == *"postgresql://"* ]]; then
    fail "${label}: output contained a database URL"
  fi
}

write_backup() {
  mkdir -p "$TMP/backup"
  printf '%s\n' 'CREATE SCHEMA public;' '-- schema' >"$TMP/backup/bloodline-schema-${STAMP}.sql"
  printf '%s\n' '-- auth' >"$TMP/backup/bloodline-auth-${STAMP}.sql"
  printf '%s\n' '-- data' >"$TMP/backup/bloodline-data-${STAMP}.sql"
}

write_psql_stub() {
  mkdir -p "$TMP/bin"
  cat >"$TMP/bin/psql" <<'EOF'
#!/usr/bin/env bash
set -u
log="${PSQL_LOG:?}"
{
  printf 'CMD'
  for arg in "$@"; do
    printf ' %q' "$arg"
  done
  printf '\n'
} >>"$log"

sql=""
prev=""
for arg in "$@"; do
  if [[ "$prev" == "-c" || "$prev" == "-Atc" ]]; then
    sql="$arg"
  fi
  prev="$arg"
done

prev_f=0
for arg in "$@"; do
  if ((prev_f)); then
    printf 'FILE %s\n' "$arg" >>"$log"
    prev_f=0
    exit 0
  fi
  if [[ "$arg" == "-f" ]]; then
    prev_f=1
  fi
done

if [[ "$sql" == *"pg_publication_tables"* ]]; then
  if [[ -n "${STUB_PUB_TABLES:-}" ]]; then
    printf '%s\n' "$STUB_PUB_TABLES"
  fi
  exit 0
fi
if [[ "$sql" == *"pg_publication"* ]]; then
  if [[ -n "${STUB_PUB:-}" ]]; then
    printf '%s\n' "$STUB_PUB"
  fi
  exit 0
fi
if [[ "$sql" == *"relkind = 'r'"* ]]; then
  if [[ -n "${STUB_TABLES:-}" ]]; then
    printf '%s\n' "$STUB_TABLES"
  fi
  exit 0
fi
if [[ "$sql" == *"FROM auth.users"* ]]; then
  printf '%s\n' "${STUB_USERS:-0}"
  exit 0
fi
if [[ "$sql" == *"ALTER PUBLICATION"* ]]; then
  printf 'ALTER\n' >>"$log"
  exit 0
fi
printf 'UNEXPECTED\n' >>"$log"
exit 97
EOF
  chmod +x "$TMP/bin/psql"
}

write_matrix_psql_stub() {
  mkdir -p "$TMP/matrix-bin"
  cat >"$TMP/matrix-bin/psql" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' 'noise that should be dropped'
printf '%s\n' $'tables\tpublic\t1'
printf '%s\n' $'indexes\tpublic\t1'
printf '%s\n' $'constraints\tpublic\t1'
printf '%s\n' $'rls\tpublic\t1'
printf '%s\n' $'policies\tpublic\t1'
printf '%s\n' $'functions\tpublic\t1'
printf '%s\n' $'triggers\tpublic\t1'
printf '%s\n' $'types\tpublic\t0'
printf '%s\n' $'table\tauth\tusers\t1\tusershash'
printf '%s\n' $'table\tauth\tidentities\t1\tidhash'
printf '%s\n' $'table\tpublic\tfarms\t1\tabc123'
printf '%s\n' $'columns\tpublic\tfarms\t3'
exit 0
EOF
  chmod +x "$TMP/matrix-bin/psql"
}

PSQL_LOG="$TMP/psql.log"
touch "$PSQL_LOG"
write_backup
write_psql_stub
write_matrix_psql_stub

run_restore() {
  local stdin_text="$1"
  shift
  : >"$PSQL_LOG"
  set +e
  OUT="$(printf '%s' "$stdin_text" | env "$@" bash "$ROOT/scripts/restore-db.sh" "$STAMP" 2>&1)"
  STATUS=$?
  set -e
}

file_restores() {
  grep -c ' -f ' "$PSQL_LOG" || true
}

common_env=(
  "PATH=$TMP/bin:$PATH"
  "PSQL_LOG=$PSQL_LOG"
  "SUPABASE_DB_URL=$URL"
  "RESTORE_DB_URL=$URL"
  "BACKUP_DIR=$TMP/backup"
)

# Missing RESTORE_INTO_SOURCE: refuse before any psql call.
run_restore "" "${common_env[@]}"
assert_eq "$STATUS" "1" "missing RESTORE_INTO_SOURCE status"
assert_grep "Refusing to restore into the live project" "missing RESTORE_INTO_SOURCE"
assert_grep "RESTORE_INTO_SOURCE=yes" "missing RESTORE_INTO_SOURCE mentions the override"
assert_no_secret "missing RESTORE_INTO_SOURCE"
assert_eq "$(file_restores)" "0" "missing RESTORE_INTO_SOURCE must not apply a backup file"
if [[ -s "$PSQL_LOG" ]]; then
  fail "missing RESTORE_INTO_SOURCE invoked psql"
fi

# A value other than the exact word yes is the same refusal.
run_restore "" "${common_env[@]}" "RESTORE_INTO_SOURCE=YES"
assert_eq "$STATUS" "1" "RESTORE_INTO_SOURCE=YES status"
assert_grep "Refusing to restore into the live project" "RESTORE_INTO_SOURCE=YES"
assert_no_secret "RESTORE_INTO_SOURCE=YES"
if [[ -s "$PSQL_LOG" ]]; then
  fail "RESTORE_INTO_SOURCE=YES invoked psql"
fi

# Public base tables present: refuse after the host is typed, before -f.
run_restore $'db.example.test\n' "${common_env[@]}" "RESTORE_INTO_SOURCE=yes" "STUB_TABLES=farms" "STUB_USERS=0"
assert_eq "$STATUS" "1" "non-empty tables status"
assert_grep "In-place restore checks:" "non-empty tables checks"
assert_grep "public base tables: 1 \\(farms\\)" "non-empty tables count"
assert_grep "auth.users rows: 0" "non-empty tables users"
assert_grep "The target is not empty" "non-empty tables refusal"
assert_no_secret "non-empty tables"
assert_eq "$(file_restores)" "0" "non-empty tables must not apply a backup file"

# auth.users rows present and no public tables: still refuse.
run_restore $'db.example.test\n' "${common_env[@]}" "RESTORE_INTO_SOURCE=yes" "STUB_USERS=4"
assert_eq "$STATUS" "1" "non-empty users status"
assert_grep "public base tables: 0" "non-empty users tables"
assert_grep "auth.users rows: 4" "non-empty users count"
assert_grep "The target is not empty" "non-empty users refusal"
assert_no_secret "non-empty users"
assert_eq "$(file_restores)" "0" "non-empty users must not apply a backup file"

# Empty target: the override proceeds to the three restore files.
run_restore $'db.example.test\n' "${common_env[@]}" "RESTORE_INTO_SOURCE=yes" "STUB_USERS=0"
assert_eq "$STATUS" "0" "empty target status"
assert_grep "public base tables: 0" "empty target tables"
assert_grep "auth.users rows: 0" "empty target users"
assert_grep "Filtered CREATE SCHEMA public;" "empty target schema filter notice"
assert_grep "Publication powersync: not found" "empty target publication"
assert_no_secret "empty target"
assert_eq "$(file_restores)" "3" "empty target applies schema, auth, and data"
grep -qxF 'CREATE SCHEMA public;' "$TMP/backup/bloodline-schema-${STAMP}.sql" \
  || fail "backup schema file on disk was modified"
schema_psql_file="$(grep '^FILE ' "$PSQL_LOG" | head -n 1 | sed 's/^FILE //')"
if [[ -z "$schema_psql_file" ]]; then
  fail "empty target: psql stub did not record a schema -f path"
fi
case "$schema_psql_file" in
  *"/.bloodline-schema-restore."*) ;;
  *)
    fail "empty target: expected a filtered temp schema file, got ${schema_psql_file}"
    ;;
esac

# prepare_schema_file_for_restore: original unchanged, temp copy omits CREATE SCHEMA.
SCHEMA_FIXTURE="$TMP/filter-schema.sql"
printf '%s\n' 'CREATE SCHEMA public;' '-- keep' >"$SCHEMA_FIXTURE"
# shellcheck disable=SC1091
source "$ROOT/scripts/restore-db.sh"
FILTERED="$(prepare_schema_file_for_restore "$SCHEMA_FIXTURE" "$TMP/backup")"
grep -qxF 'CREATE SCHEMA public;' "$SCHEMA_FIXTURE" \
  || fail "filter unit: original fixture lost CREATE SCHEMA public;"
if [[ "$FILTERED" == "$SCHEMA_FIXTURE" ]]; then
  fail "filter unit: expected a temp file when CREATE SCHEMA public; is present"
fi
grep -qxF 'CREATE SCHEMA public;' "$FILTERED" \
  && fail "filter unit: filtered file still contains CREATE SCHEMA public;"
grep -qxF -- '-- keep' "$FILTERED" || fail "filter unit: filtered file dropped other lines"
rm -f -- "$FILTERED"

# compare-validation.sh ignores '#' headers.
BEFORE="$TMP/before.tsv"
AFTER="$TMP/after.tsv"
printf '%s\n' '# host=db.example.test timestamp=2000-01-01T00:00:00Z' $'tables\tpublic\t1' >"$BEFORE"
printf '%s\n' '# host=other.example timestamp=2001-01-01T00:00:00Z' $'tables\tpublic\t1' >"$AFTER"
set +e
OUT="$(bash "$ROOT/scripts/compare-validation.sh" "$BEFORE" "$AFTER" 2>&1)"
STATUS=$?
set -e
assert_eq "$STATUS" "0" "header-only difference status"
assert_grep "Validation matrices match" "header-only difference"

printf '%s\n' '# host=db.example.test timestamp=2000-01-01T00:00:00Z' $'table\tpublic\tfarms\t1\taaa' >"$BEFORE"
printf '%s\n' '# host=other.example timestamp=2001-01-01T00:00:00Z' $'table\tpublic\tfarms\t2\tbbb' >"$AFTER"
set +e
OUT="$(bash "$ROOT/scripts/compare-validation.sh" "$BEFORE" "$AFTER" 2>&1)"
STATUS=$?
set -e
assert_eq "$STATUS" "1" "changed row status"
assert_grep "changed" "changed row status word"
assert_grep "table public farms" "changed row key"
assert_grep "aaa" "changed row before"
assert_grep "bbb" "changed row after"
if [[ "$OUT" == *"# host="* ]]; then
  fail "compare printed a header line"
fi

printf '%s\n' $'tables\tpublic\t1' $'rls\tpublic\t1' >"$BEFORE"
printf '%s\n' $'rls\tpublic\t1' $'tables\tpublic\t1' >"$AFTER"
set +e
OUT="$(bash "$ROOT/scripts/compare-validation.sh" "$BEFORE" "$AFTER" 2>&1)"
STATUS=$?
set -e
assert_eq "$STATUS" "1" "order-only difference status"
assert_grep "order does not" "order-only difference"

# Matrix writer: sort, drop noise, print the host once, never print the URL.
MATRIX="$TMP/matrix.tsv"
set +e
OUT="$(
  PATH="$TMP/matrix-bin:$PATH" \
    SUPABASE_DB_URL="$URL" \
    bash "$ROOT/scripts/db-validation-matrix.sh" "$MATRIX" 2>&1
)"
STATUS=$?
set -e
assert_eq "$STATUS" "0" "matrix status"
assert_no_secret "matrix"
assert_grep "^# host=db\\.example\\.test timestamp=[0-9]{4}-[0-9]{2}-[0-9]{2}T" "matrix header"
cmp -s -- "$MATRIX" <(printf '%s\n' "$OUT") || fail "matrix stdout does not match the output file"
tail -n +2 "$MATRIX" >"$TMP/matrix-body.tsv"
printf '%s\n' \
  $'columns\tpublic\tfarms\t3' \
  $'constraints\tpublic\t1' \
  $'functions\tpublic\t1' \
  $'indexes\tpublic\t1' \
  $'policies\tpublic\t1' \
  $'rls\tpublic\t1' \
  $'table\tauth\tidentities\t1\tidhash' \
  $'table\tauth\tusers\t1\tusershash' \
  $'table\tpublic\tfarms\t1\tabc123' \
  $'tables\tpublic\t1' \
  $'triggers\tpublic\t1' \
  $'types\tpublic\t0' >"$TMP/matrix-expect.tsv"
cmp -s -- "$TMP/matrix-body.tsv" "$TMP/matrix-expect.tsv" || fail "matrix body is not the sorted fixture"

MATRIX_AGAIN="$TMP/matrix-again.tsv"
PATH="$TMP/matrix-bin:$PATH" \
  SUPABASE_DB_URL="$URL" \
  bash "$ROOT/scripts/db-validation-matrix.sh" "$MATRIX_AGAIN" >/dev/null
set +e
OUT="$(bash "$ROOT/scripts/compare-validation.sh" "$MATRIX" "$MATRIX_AGAIN" 2>&1)"
STATUS=$?
set -e
assert_eq "$STATUS" "0" "two matrix runs"
assert_grep "Validation matrices match" "two matrix runs"

OTHER_URL="postgresql://postgres:${SECRET}@db.other.test:5432/postgres"
MATRIX_OTHER="$TMP/matrix-other.tsv"
set +e
OUT="$(
  env -u SUPABASE_DB_URL \
    PATH="$TMP/matrix-bin:$PATH" \
    OTHER_URL="$OTHER_URL" \
    bash "$ROOT/scripts/db-validation-matrix.sh" --url-var OTHER_URL "$MATRIX_OTHER" 2>&1
)"
STATUS=$?
set -e
assert_eq "$STATUS" "0" "--url-var status"
assert_no_secret "--url-var"
assert_grep "^# host=db\\.other\\.test timestamp=" "--url-var host"

echo "assert-restore-guards: ok"
