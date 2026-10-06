#!/usr/bin/env bash
# Read-only validation matrix for a Bloodline Book Postgres database.
#
# Uses psql only. It does not insert, update, delete, or change schema.
# The session is default_transaction_read_only, and the script is one
# repeatable-read, read-only transaction.
#
# Usage:
#   export SUPABASE_DB_URL='postgresql://...'
#   bash scripts/db-validation-matrix.sh /path/outside/the/repo/matrix.tsv
#   bash scripts/db-validation-matrix.sh --url-var RESTORE_DB_URL /path/matrix.tsv
#
# The connection string is the variable SUPABASE_DB_URL, unless --url-var NAME
# names a different variable. The URL is never printed. The output file and
# stdout start with one header line:
#   # host=<host> timestamp=<UTC>
# compare-validation.sh ignores lines that start with '#'.
#
# Body rows are tab-separated and sorted with LC_ALL=C, so two runs against
# an identical database match after the header is ignored:
#   tables        public                  <count of base tables>
#   columns       public  <table>         <column count>
#   indexes       public                  <count of indexes>
#   constraints   public                  <count of constraints>
#   rls           public                  <count of base tables with RLS on>
#   policies      public                  <count of pg_policies rows>
#   functions     public                  <count of functions, prokind f>
#   triggers      public                  <count of non-internal triggers>
#   trigger_name  auth    users  <name>   <one row per non-internal trigger>
#   types         public                  <user-defined types, not row types>
#   table         public  <table> <rows> <md5 of t::text, ordered>
#   table         auth    users   <rows> <md5>
#   table         auth    identities <rows> <md5>
#   publication   <name>  all_tables  yes|no  tables  <schema.table,...|none>
#
# The md5 for each table is:
#   select md5(coalesce(string_agg(t::text, E'\n' order by t::text), ''))
#   from <schema>.<table> t
# That reads every row. Keep the file outside this git repository.

set -euo pipefail
shopt -s inherit_errexit 2>/dev/null || true

SQL_TMP=""
RAW_TMP=""
FILTERED_TMP=""
SORTED_TMP=""
OUT_TMP=""
ERR_TMP=""

usage() {
  cat >&2 <<'EOF'
Usage: bash scripts/db-validation-matrix.sh [--url-var NAME] OUTPUT
Writes a read-only validation matrix to OUTPUT and prints that file.
SUPABASE_DB_URL is the Postgres connection string, unless --url-var NAME
selects another variable. The URL is never printed.
EOF
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

cleanup() {
  local f
  for f in "$SQL_TMP" "$RAW_TMP" "$FILTERED_TMP" "$SORTED_TMP" "$OUT_TMP" "$ERR_TMP"; do
    if [[ -n "$f" ]]; then
      rm -f -- "$f"
    fi
  done
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

db_password() {
  local url="$1"
  local rest userinfo
  case "$url" in
    postgres://* | postgresql://*) ;;
    *)
      printf '\n'
      return 0
      ;;
  esac
  rest="${url#*://}"
  if [[ "$rest" != *@* ]]; then
    printf '\n'
    return 0
  fi
  userinfo="${rest%@*}"
  if [[ "$userinfo" != *:* ]]; then
    printf '\n'
    return 0
  fi
  printf '%s\n' "${userinfo#*:}"
}

scrub_file() {
  local file="$1"
  local text password
  if [[ ! -s "$file" ]]; then
    return 0
  fi
  text="$(cat "$file")"
  if [[ -n "${DB_URL:-}" ]]; then
    text="${text//"$DB_URL"/(database url redacted)}"
  fi
  password="$(db_password "$DB_URL")" || true
  if [[ ${#password} -ge 8 ]]; then
    text="${text//"$password"/(redacted)}"
  fi
  printf '%s\n' "$text" >&2
}

write_sql() {
  local file="$1"
  cat >"$file" <<'EOF'
-- Read-only. psql wraps this file in one transaction (--single-transaction).
-- Row hashes use: md5(coalesce(string_agg(t::text, E'\n' order by t::text), ''))

SELECT 'tables' || E'\t' || 'public' || E'\t' || count(*)::text
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r';

SELECT 'columns' || E'\t' || 'public' || E'\t' || c.relname || E'\t' || (
  SELECT count(*)::text
  FROM pg_attribute a
  WHERE a.attrelid = c.oid
    AND a.attnum > 0
    AND NOT a.attisdropped
)
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relname;

SELECT 'indexes' || E'\t' || 'public' || E'\t' || count(*)::text
FROM pg_class i
JOIN pg_namespace n ON n.oid = i.relnamespace
WHERE n.nspname = 'public'
  AND i.relkind IN ('i', 'I');

SELECT 'constraints' || E'\t' || 'public' || E'\t' || count(*)::text
FROM pg_constraint con
JOIN pg_namespace n ON n.oid = con.connamespace
WHERE n.nspname = 'public';

SELECT 'rls' || E'\t' || 'public' || E'\t' || count(*)::text
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity;

SELECT 'policies' || E'\t' || 'public' || E'\t' || count(*)::text
FROM pg_policies
WHERE schemaname = 'public';

SELECT 'functions' || E'\t' || 'public' || E'\t' || count(*)::text
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prokind = 'f';

SELECT 'triggers' || E'\t' || 'public' || E'\t' || count(*)::text
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND NOT t.tgisinternal;

SELECT 'trigger_name' || E'\t' || 'auth' || E'\t' || 'users' || E'\t' || t.tgname
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'auth'
  AND c.relname = 'users'
  AND NOT t.tgisinternal
ORDER BY t.tgname;

SELECT 'types' || E'\t' || 'public' || E'\t' || count(*)::text
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
  AND t.typisdefined
  AND t.typcategory IS DISTINCT FROM 'A'
  AND t.typtype IN ('b', 'c', 'd', 'e', 'r')
  AND NOT EXISTS (
    SELECT 1
    FROM pg_class c
    WHERE c.reltype = t.oid
      AND c.relkind IN ('r', 'p', 'v', 'm', 'c', 'f')
  );

SELECT 'table' || E'\t' || 'auth' || E'\t' || 'users' || E'\t' || count(*)::text || E'\t' || md5(coalesce(string_agg(t::text, E'\n' ORDER BY t::text), ''))
FROM auth.users t;

SELECT 'table' || E'\t' || 'auth' || E'\t' || 'identities' || E'\t' || count(*)::text || E'\t' || md5(coalesce(string_agg(t::text, E'\n' ORDER BY t::text), ''))
FROM auth.identities t;

SELECT 'publication' || E'\t' || p.pubname
  || E'\t' || 'all_tables'
  || E'\t' || CASE WHEN p.puballtables THEN 'yes' ELSE 'no' END
  || E'\t' || 'tables'
  || E'\t' || coalesce(
       string_agg(pt.schemaname || '.' || pt.tablename, ',' ORDER BY pt.schemaname, pt.tablename),
       'none'
     )
FROM pg_publication p
LEFT JOIN pg_publication_tables pt ON pt.pubname = p.pubname
GROUP BY p.oid, p.pubname, p.puballtables
ORDER BY p.pubname;

SELECT format(
  'SELECT %L || E''\t'' || %L || E''\t'' || %L || E''\t'' || count(*)::text || E''\t'' || md5(coalesce(string_agg(t::text, E''\n'' ORDER BY t::text), '''')) FROM %I.%I t',
  'table', n.nspname, c.relname, n.nspname, c.relname
)
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relname
\gexec
EOF
}

assert_complete_matrix() {
  local file="$1"
  local line rest name prefix required
  local -a required_rows=(
    $'tables\tpublic\t'
    $'indexes\tpublic\t'
    $'constraints\tpublic\t'
    $'rls\tpublic\t'
    $'policies\tpublic\t'
    $'functions\tpublic\t'
    $'triggers\tpublic\t'
    $'types\tpublic\t'
    $'table\tauth\tusers\t'
    $'table\tauth\tidentities\t'
  )
  for required in "${required_rows[@]}"; do
    if ! grep -F -q -- "$required" "$file"; then
      fail "Validation matrix is missing a required row (${required%%$'\t'*}). The connection string was not printed."
    fi
  done
  local -a column_tables=()
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" == columns$'\t'* ]] || continue
    rest="${line#*$'\t'}"
    rest="${rest#*$'\t'}"
    name="${rest%%$'\t'*}"
    column_tables+=("$name")
  done <"$file"
  for name in "${column_tables[@]}"; do
    prefix=$'table\tpublic\t'"${name}"$'\t'
    if ! grep -F -q -- "$prefix" "$file"; then
      fail "Validation matrix is missing the row hash for public.${name}. The connection string was not printed."
    fi
  done
}

filter_rows() {
  local src="$1"
  local dest="$2"
  local line
  : >"$dest"
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line//$'\r'/}"
    [[ -z "$line" ]] && continue
    case "$line" in
      columns$'\t'* | constraints$'\t'* | functions$'\t'* | indexes$'\t'* | policies$'\t'* | publication$'\t'* | rls$'\t'* | table$'\t'* | tables$'\t'* | trigger_name$'\t'* | triggers$'\t'* | types$'\t'*)
        printf '%s\n' "$line" >>"$dest"
        ;;
    esac
  done <"$src"
}

assert_no_secret() {
  local file="$1"
  local password
  if grep -F -q -- "$DB_URL" "$file"; then
    fail "Refusing to write the matrix because the result contained the connection string."
  fi
  password="$(db_password "$DB_URL")" || true
  if [[ ${#password} -ge 8 ]] && grep -F -q -- "$password" "$file"; then
    fail "Refusing to write the matrix because the result contained a credential."
  fi
}

main() {
  local url_var="SUPABASE_DB_URL"
  local output=""
  local host stamp out_dir

  trap cleanup EXIT

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --url-var)
        if [[ $# -lt 2 ]]; then
          usage
          fail "--url-var requires a variable name."
        fi
        url_var="$2"
        shift 2
        ;;
      -h | --help)
        usage
        exit 0
        ;;
      --)
        shift
        break
        ;;
      -*)
        usage
        fail "Unknown option: $1"
        ;;
      *)
        if [[ -n "$output" ]]; then
          usage
          fail "Pass one output file path."
        fi
        output="$1"
        shift
        ;;
    esac
  done
  if [[ $# -gt 0 ]]; then
    usage
    fail "Pass one output file path."
  fi
  if [[ -z "$output" ]]; then
    usage
    fail "Pass the output file path."
  fi
  if [[ "$output" == "-" ]]; then
    fail "Pass a file path. This script does not write the matrix to a nameless stdout-only destination."
  fi
  if [[ ! "$url_var" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
    fail "--url-var name must be a shell variable name. The connection string was not printed."
  fi
  if [[ -z "${!url_var:-}" ]]; then
    fail "${url_var} is not set. Export the Postgres connection string in the shell. Do not read it from the repo or from .env."
  fi

  DB_URL="${!url_var}"
  host="$(db_host "$DB_URL")" || exit 1
  # The host is printed once, in the output header. The URL is not printed.

  if ! command -v psql >/dev/null 2>&1; then
    fail "psql is not installed. Install the PostgreSQL client tools and retry."
  fi

  out_dir="$(dirname -- "$output")"
  if [[ ! -d "$out_dir" ]]; then
    fail "Output directory does not exist: ${out_dir}"
  fi

  SQL_TMP="$(mktemp)" || fail "Could not create a temporary SQL file."
  RAW_TMP="$(mktemp)" || fail "Could not create a temporary file."
  FILTERED_TMP="$(mktemp)" || fail "Could not create a temporary file."
  SORTED_TMP="$(mktemp)" || fail "Could not create a temporary file."
  write_sql "$SQL_TMP"

  local psql_status
  ERR_TMP="$(mktemp)" || fail "Could not create a temporary file."

  set +e
  PGOPTIONS="-c default_transaction_read_only=on${PGOPTIONS:+ ${PGOPTIONS}}" \
    psql "$DB_URL" -X -1 -v ON_ERROR_STOP=1 -At -f "$SQL_TMP" >"$RAW_TMP" 2>"$ERR_TMP"
  psql_status=$?
  set -e
  if ((psql_status != 0)); then
    scrub_file "$ERR_TMP"
    fail "psql failed while reading the validation matrix. The connection string was not printed."
  fi
  rm -f -- "$ERR_TMP"
  ERR_TMP=""

  filter_rows "$RAW_TMP" "$FILTERED_TMP"
  if [[ ! -s "$FILTERED_TMP" ]]; then
    fail "Validation query returned no matrix rows. The connection string was not printed."
  fi
  LC_ALL=C sort -o "$SORTED_TMP" "$FILTERED_TMP"
  assert_complete_matrix "$SORTED_TMP"
  assert_no_secret "$SORTED_TMP"

  stamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)" || fail "Could not format the timestamp."
  OUT_TMP="$(mktemp "${out_dir}/.db-validation.XXXXXX")" || fail "Could not create the output file."
  {
    printf '# host=%s timestamp=%s\n' "$host" "$stamp"
    cat "$SORTED_TMP"
  } >"$OUT_TMP"
  assert_no_secret "$OUT_TMP"
  mv -- "$OUT_TMP" "$output"
  OUT_TMP=""
  cat -- "$output"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
