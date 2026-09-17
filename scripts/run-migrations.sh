#!/usr/bin/env bash
# Apply pending SQL migrations to the Supabase project for the current DATABASE_TARGET.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "ERROR: SUPABASE_ACCESS_TOKEN is required to run migrations remotely."
  exit 1
fi

SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL:-}"
if [[ -z "$SUPABASE_URL" ]]; then
  echo "ERROR: EXPO_PUBLIC_SUPABASE_URL is not set. Run scripts/setup-env.sh first."
  exit 1
fi

PROJECT_REF="$(echo "$SUPABASE_URL" | sed -E 's#https://([^.]+)\.supabase\.co.*#\1#')"

run_sql_file() {
  local file="$1"
  local name
  name="$(basename "$file")"
  echo "Applying $name …"
  node -e "
    const https = require('https');
    const fs = require('fs');
    const sql = fs.readFileSync('${file}', 'utf8');
    const body = JSON.stringify({ query: sql });
    const req = https.request({
      hostname: 'api.supabase.com',
      path: '/v1/projects/${PROJECT_REF}/database/query',
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + process.env.SUPABASE_ACCESS_TOKEN,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        if (res.statusCode >= 400) {
          console.error('Failed ${name}:', res.statusCode, data);
          process.exit(1);
        }
        console.log('OK ${name}');
      });
    });
    req.on('error', (err) => {
      console.error(err);
      process.exit(1);
    });
    req.write(body);
    req.end();
  "
}

echo "Target: ${EXPO_PUBLIC_DATABASE_TARGET:-unknown} (${PROJECT_REF})"

for file in "$ROOT"/supabase/migrations/*.sql; do
  run_sql_file "$file"
done

echo "All migrations applied."
