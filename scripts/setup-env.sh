#!/usr/bin/env bash
# Writes .env from Cloud Agent secrets, picking the database by git branch.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"

normalize_supabase_url() {
  local url="${1%/}"
  url="${url%/rest/v1}"
  echo "${url%/}"
}

extract_project_ref() {
  local url="$1"
  if [[ "$url" =~ https://([a-z0-9]+)\.supabase\.co ]]; then
    echo "${BASH_REMATCH[1]}"
  fi
}

fetch_anon_key() {
  local project_ref="$1"
  if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" || -z "$project_ref" ]]; then
    return 1
  fi
  node -e "
    const https = require('https');
    const options = {
      hostname: 'api.supabase.com',
      path: '/v1/projects/${project_ref}/api-keys',
      headers: { Authorization: 'Bearer ' + process.env.SUPABASE_ACCESS_TOKEN },
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          const keys = JSON.parse(data);
          const anon = keys.find((k) => k.name === 'anon');
          const publishable = keys.find((k) =>
            (k.api_key || '').startsWith('sb_publishable_'),
          );
          const key = anon?.api_key || publishable?.api_key;
          if (key) process.stdout.write(key);
        } catch {}
      });
    }).on('error', () => process.exit(1));
  " 2>/dev/null
}

resolve_database_target() {
  if [[ -n "${DATABASE_TARGET:-}" ]]; then
    echo "$DATABASE_TARGET"
    return
  fi

  local branch
  branch="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")"

  case "$branch" in
    main|master|production|release/*)
      echo "production"
      ;;
    *)
      echo "development"
      ;;
  esac
}

DATABASE_TARGET="$(resolve_database_target)"

if [[ "$DATABASE_TARGET" != "development" && "$DATABASE_TARGET" != "production" ]]; then
  echo "ERROR: DATABASE_TARGET must be 'development' or 'production' (got: $DATABASE_TARGET)"
  exit 1
fi

if [[ "$DATABASE_TARGET" == "production" ]]; then
  SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL_PROD:-${EXPO_PUBLIC_SUPABASE_URL:-}}"
  SUPABASE_ANON_KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY_PROD:-${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}}"
  POWERSYNC_URL="${EXPO_PUBLIC_POWERSYNC_URL_PROD:-${EXPO_PUBLIC_POWERSYNC_URL:-}}"
else
  SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL:-${NEXT_PUBLIC_SUPABASE_URL:-}}"
  SUPABASE_ANON_KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY:-${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}}"
  POWERSYNC_URL="${EXPO_PUBLIC_POWERSYNC_URL:-}"
fi

SUPABASE_URL="$(normalize_supabase_url "$SUPABASE_URL")"

if [[ "$SUPABASE_URL" == *"/rest/v1"* ]]; then
  echo "WARNING: Supabase URL should be https://<ref>.supabase.co (not /rest/v1)."
fi

PROJECT_REF="$(extract_project_ref "$SUPABASE_URL")"
if [[ -n "$PROJECT_REF" ]]; then
  FRESH_KEY="$(fetch_anon_key "$PROJECT_REF" || true)"
  if [[ -n "$FRESH_KEY" ]]; then
    SUPABASE_ANON_KEY="$FRESH_KEY"
    echo "Refreshed anon key from Supabase API for project ${PROJECT_REF}."
  fi
fi

cat > "$ENV_FILE" <<EOF
EXPO_PUBLIC_DATABASE_TARGET=${DATABASE_TARGET}
EXPO_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
EXPO_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
EXPO_PUBLIC_POWERSYNC_URL=${POWERSYNC_URL}
EOF

echo "Wrote $ENV_FILE (database=${DATABASE_TARGET}, branch=$(git -C "$ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown))"

npx --yes @powersync/web copy-assets --output public 2>/dev/null || true

if [[ -z "$POWERSYNC_URL" ]]; then
  echo "WARNING: PowerSync URL is not set for ${DATABASE_TARGET} database."
  if [[ "$DATABASE_TARGET" == "production" ]]; then
    echo "  Set EXPO_PUBLIC_POWERSYNC_URL_PROD (or _PROD suffix secrets)."
  else
    echo "  Set EXPO_PUBLIC_POWERSYNC_URL."
  fi
fi
