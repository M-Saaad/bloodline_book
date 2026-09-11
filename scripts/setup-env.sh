#!/usr/bin/env bash
# Writes .env from Cloud Agent secrets, picking the database by git branch.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"

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
