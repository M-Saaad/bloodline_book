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

# Secrets sometimes duplicate the JWT header (header.header.payload.sig).
sanitize_supabase_jwt_key() {
  local key="${1-}"
  local p0 p1 p2 p3 extra
  IFS='.' read -r p0 p1 p2 p3 extra <<< "$key"
  if [[ -n "$p0" && -n "$p1" && -n "$p2" && -n "$p3" && -z "$extra" && "$p0" == "$p1" && "$p0" == eyJ* ]]; then
    echo "${p0}.${p2}.${p3}"
    return
  fi
  echo "$key"
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

read_env_value() {
  local key="$1"
  if [[ ! -f "$ENV_FILE" ]]; then
    return 0
  fi
  local line
  line="$(grep -m1 "^${key}=" "$ENV_FILE" 2>/dev/null || true)"
  if [[ -n "$line" ]]; then
    echo "${line#*=}"
  fi
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
  SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL_PROD:-${EXPO_PUBLIC_SUPABASE_URL:-${NEXT_PUBLIC_SUPABASE_URL:-}}}"
  SUPABASE_ANON_KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY_PROD:-${EXPO_PUBLIC_SUPABASE_ANON_KEY:-${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}}}"
  POWERSYNC_URL="${EXPO_PUBLIC_POWERSYNC_URL_PROD:-${EXPO_PUBLIC_POWERSYNC_URL:-}}"
else
  SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL:-${NEXT_PUBLIC_SUPABASE_URL:-}}"
  SUPABASE_ANON_KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY:-${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}}"
  POWERSYNC_URL="${EXPO_PUBLIC_POWERSYNC_URL:-}"
fi

# tmux / child shells may not inherit Cloud Agent secrets — keep existing .env values.
if [[ -z "$SUPABASE_URL" ]]; then
  SUPABASE_URL="$(read_env_value EXPO_PUBLIC_SUPABASE_URL)"
fi
if [[ -z "$SUPABASE_ANON_KEY" ]]; then
  SUPABASE_ANON_KEY="$(read_env_value EXPO_PUBLIC_SUPABASE_ANON_KEY)"
fi
if [[ -z "$POWERSYNC_URL" ]]; then
  POWERSYNC_URL="$(read_env_value EXPO_PUBLIC_POWERSYNC_URL)"
fi

# One-project setups only store prod secrets. Reuse them on feature branches
# so Cloud Agent web still talks to the same Supabase/PowerSync as Vercel prod.
if [[ -z "$SUPABASE_URL" ]]; then
  SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL_PROD:-$(read_env_value EXPO_PUBLIC_SUPABASE_URL_PROD)}"
fi
if [[ -z "$SUPABASE_ANON_KEY" ]]; then
  SUPABASE_ANON_KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY_PROD:-$(read_env_value EXPO_PUBLIC_SUPABASE_ANON_KEY_PROD)}"
fi
if [[ -z "$POWERSYNC_URL" ]]; then
  POWERSYNC_URL="${EXPO_PUBLIC_POWERSYNC_URL_PROD:-$(read_env_value EXPO_PUBLIC_POWERSYNC_URL_PROD)}"
fi

SUPABASE_URL="$(normalize_supabase_url "$SUPABASE_URL")"
SUPABASE_ANON_KEY="$(sanitize_supabase_jwt_key "$SUPABASE_ANON_KEY")"

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

SUPABASE_ANON_KEY="$(sanitize_supabase_jwt_key "$SUPABASE_ANON_KEY")"

cat > "$ENV_FILE" <<EOF
EXPO_PUBLIC_DATABASE_TARGET=${DATABASE_TARGET}
EXPO_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
EXPO_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
EXPO_PUBLIC_POWERSYNC_URL=${POWERSYNC_URL}
EOF

echo "Wrote $ENV_FILE (database=${DATABASE_TARGET}, branch=$(git -C "$ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown))"

bash "$ROOT/scripts/copy-powersync-web-assets.sh" 2>/dev/null || true

if [[ -z "$POWERSYNC_URL" ]]; then
  echo "ERROR: PowerSync URL is not set for ${DATABASE_TARGET} database."
  if [[ "$DATABASE_TARGET" == "production" ]]; then
    echo "  Set EXPO_PUBLIC_POWERSYNC_URL_PROD in Cloud Agent secrets."
  else
    echo "  Set EXPO_PUBLIC_POWERSYNC_URL in Cloud Agent secrets."
  fi
  echo "  Get it from PowerSync Dashboard → Connect on your instance."
  exit 1
fi
