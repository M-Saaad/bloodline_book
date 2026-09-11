#!/usr/bin/env bash
# Writes .env from Cloud Agent injected secrets (run on each agent boot).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"
APP_ENV="${APP_ENV:-${EXPO_PUBLIC_APP_ENV:-development}}"

if [[ "$APP_ENV" != "development" && "$APP_ENV" != "production" ]]; then
  echo "ERROR: APP_ENV must be 'development' or 'production' (got: $APP_ENV)"
  exit 1
fi

if [[ "$APP_ENV" == "production" ]]; then
  SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL_PROD:-${EXPO_PUBLIC_SUPABASE_URL:-}}"
  SUPABASE_ANON_KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY_PROD:-${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}}"
  POWERSYNC_URL="${EXPO_PUBLIC_POWERSYNC_URL_PROD:-${EXPO_PUBLIC_POWERSYNC_URL:-}}"
else
  SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL:-${NEXT_PUBLIC_SUPABASE_URL:-}}"
  SUPABASE_ANON_KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY:-${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}}"
  POWERSYNC_URL="${EXPO_PUBLIC_POWERSYNC_URL:-}"
fi

cat > "$ENV_FILE" <<EOF
EXPO_PUBLIC_APP_ENV=${APP_ENV}
EXPO_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
EXPO_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
EXPO_PUBLIC_POWERSYNC_URL=${POWERSYNC_URL}
EOF

echo "Wrote $ENV_FILE (APP_ENV=${APP_ENV})"

# PowerSync web workers must live in public/ for Expo Metro on web.
npx --yes @powersync/web copy-assets --output public 2>/dev/null || true

if [[ -z "$POWERSYNC_URL" ]]; then
  echo "WARNING: PowerSync URL is not set for ${APP_ENV}."
  if [[ "$APP_ENV" == "production" ]]; then
    echo "  Set EXPO_PUBLIC_POWERSYNC_URL_PROD in environment secrets."
  else
    echo "  Set EXPO_PUBLIC_POWERSYNC_URL in environment secrets."
  fi
fi
