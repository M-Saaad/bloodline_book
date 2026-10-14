#!/usr/bin/env bash
# Install PostgreSQL client tools (psql, pg_dump) whose major version is at
# least the server's major. Used by GitHub Actions backup/restore workflows.
#
# Usage:
#   SUPABASE_DB_URL=... bash scripts/ci-install-pg-client.sh
#   bash scripts/ci-install-pg-client.sh 'postgresql://...'

set -euo pipefail

db_url="${1:-${SUPABASE_DB_URL:-${DATABASE_URL:-}}}"
if [[ -z "$db_url" ]]; then
  echo "ERROR: Pass a Postgres URL as an argument or set SUPABASE_DB_URL." >&2
  exit 1
fi

major_from_server_version() {
  local raw="$1"
  raw="${raw//$'\r'/}"
  raw="${raw%%$'\n'*}"
  if [[ "$raw" =~ ^[[:space:]]*([0-9]+) ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
    return 0
  fi
  echo "ERROR: Could not parse server version from psql." >&2
  exit 1
}

activate_pg_client_major() {
  local major="$1"
  local bindir="/usr/lib/postgresql/${major}/bin"
  if [[ -x "${bindir}/pg_dump" && -x "${bindir}/psql" ]]; then
    export PATH="${bindir}:${PATH}"
  fi
}

major_from_pg_dump_version() {
  local raw
  raw="$(pg_dump --version 2>/dev/null || true)"
  if [[ "$raw" =~ ([0-9]+)\.[0-9]+ ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
    return 0
  fi
  printf '\n'
}

install_default_client() {
  if command -v psql >/dev/null 2>&1 && command -v pg_dump >/dev/null 2>&1; then
    return 0
  fi
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql-client
}

install_pgdg_client() {
  local major="$1"
  if ! command -v curl >/dev/null 2>&1; then
    sudo apt-get update -qq
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq curl ca-certificates
  fi
  sudo install -d /usr/share/postgresql-common/pgdg
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    | sudo tee /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc >/dev/null
  . /etc/os-release
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" \
    | sudo tee /etc/apt/sources.list.d/pgdg.list >/dev/null
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "postgresql-client-${major}"
}

install_default_client

server_raw="$(psql "$db_url" -X -v ON_ERROR_STOP=1 -Atc 'show server_version')" \
  || { echo "ERROR: psql could not read server_version. The URL was not printed." >&2; exit 1; }
server_major="$(major_from_server_version "$server_raw")"
dump_major="$(major_from_pg_dump_version)"

echo "PostgreSQL server major ${server_major}; pg_dump major ${dump_major:-unknown}"

if [[ -z "$dump_major" ]] || ((10#$dump_major < 10#$server_major)); then
  echo "Installing postgresql-client-${server_major} from PGDG."
  install_pgdg_client "$server_major"
  activate_pg_client_major "$server_major"
  dump_major="$(major_from_pg_dump_version)"
fi

if [[ -n "$dump_major" ]] && ((10#$dump_major < 10#$server_major)); then
  activate_pg_client_major "$server_major"
  dump_major="$(major_from_pg_dump_version)"
fi

if [[ -z "$dump_major" ]] || ((10#$dump_major < 10#$server_major)); then
  echo "ERROR: pg_dump is still older than the server after install." >&2
  exit 1
fi

echo "Using pg_dump major ${dump_major} (server major ${server_major})."
