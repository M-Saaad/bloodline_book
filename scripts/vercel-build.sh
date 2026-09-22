#!/usr/bin/env bash
# Vercel build: static Expo web export with PowerSync worker assets.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

normalize_supabase_url() {
  local url="${1%/}"
  url="${url%/rest/v1}"
  echo "${url%/}"
}

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

# Vercel sets VERCEL_ENV to production | preview | development
case "${VERCEL_ENV:-preview}" in
  production)
    export EXPO_PUBLIC_DATABASE_TARGET=production
    ;;
  *)
    export EXPO_PUBLIC_DATABASE_TARGET=development
    ;;
esac

echo "Vercel build: VERCEL_ENV=${VERCEL_ENV:-unknown}, database=${EXPO_PUBLIC_DATABASE_TARGET}"

# Expo reads EXPO_PUBLIC_* at build time. Older Vercel projects (Next.js era) used
# NEXT_PUBLIC_* — map those so existing dashboard vars keep working.
# Production deploys may also use *_PROD suffixes (same naming as Cloud Agent secrets).
if [[ "${EXPO_PUBLIC_DATABASE_TARGET}" == "production" ]]; then
  export EXPO_PUBLIC_SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL:-${EXPO_PUBLIC_SUPABASE_URL_PROD:-${NEXT_PUBLIC_SUPABASE_URL:-}}}"
  export EXPO_PUBLIC_SUPABASE_ANON_KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY:-${EXPO_PUBLIC_SUPABASE_ANON_KEY_PROD:-${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}}}"
  export EXPO_PUBLIC_POWERSYNC_URL="${EXPO_PUBLIC_POWERSYNC_URL:-${EXPO_PUBLIC_POWERSYNC_URL_PROD:-}}"
else
  export EXPO_PUBLIC_SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL:-${NEXT_PUBLIC_SUPABASE_URL:-}}"
  export EXPO_PUBLIC_SUPABASE_ANON_KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY:-${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}}"
  # Preview builds only receive Preview-scoped vars; fall back to legacy names and
  # non-prefixed secrets when teams use a single shared PowerSync URL (see project docs).
  export EXPO_PUBLIC_POWERSYNC_URL="${EXPO_PUBLIC_POWERSYNC_URL:-${NEXT_PUBLIC_POWERSYNC_URL:-${POWERSYNC_URL:-}}}"
fi

if [[ -n "${EXPO_PUBLIC_SUPABASE_URL:-}" ]]; then
  export EXPO_PUBLIC_SUPABASE_URL="$(normalize_supabase_url "$EXPO_PUBLIC_SUPABASE_URL")"
fi

if [[ -n "${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}" ]]; then
  export EXPO_PUBLIC_SUPABASE_ANON_KEY="$(sanitize_supabase_jwt_key "$EXPO_PUBLIC_SUPABASE_ANON_KEY")"
fi

if [[ -z "${EXPO_PUBLIC_SUPABASE_URL:-}" || -z "${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}" ]]; then
  echo "ERROR: Supabase env vars missing for Expo web export."
  echo "  Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in Vercel."
  echo "  (Legacy NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are also accepted.)"
  exit 1
fi

if [[ -z "${EXPO_PUBLIC_POWERSYNC_URL:-}" ]]; then
  echo "ERROR: PowerSync URL is not set in Vercel."
  if [[ "${EXPO_PUBLIC_DATABASE_TARGET}" == "production" ]]; then
    echo "  Set EXPO_PUBLIC_POWERSYNC_URL or EXPO_PUBLIC_POWERSYNC_URL_PROD (Production scope)."
  else
    echo "  Set EXPO_PUBLIC_POWERSYNC_URL (Preview scope)."
  fi
  echo "  Get the URL from PowerSync Dashboard → Connect on your instance."
  exit 1
fi

echo "Supabase URL host: ${EXPO_PUBLIC_SUPABASE_URL#https://}"
echo "PowerSync URL set: yes"

# Expo loads .env at export time; writing one avoids cases where only Vercel-injected
# shell vars are not picked up consistently across Expo CLI versions.
cat > .env <<EOF
EXPO_PUBLIC_DATABASE_TARGET=${EXPO_PUBLIC_DATABASE_TARGET}
EXPO_PUBLIC_SUPABASE_URL=${EXPO_PUBLIC_SUPABASE_URL}
EXPO_PUBLIC_SUPABASE_ANON_KEY=${EXPO_PUBLIC_SUPABASE_ANON_KEY}
EXPO_PUBLIC_POWERSYNC_URL=${EXPO_PUBLIC_POWERSYNC_URL}
EOF

bash "$ROOT/scripts/copy-powersync-web-assets.sh"
npx expo export --platform web

if grep -R -q -E 'placeholder\.supabase\.co|placeholder-anon-key|your-project\.supabase\.co' dist; then
  echo "ERROR: Built bundle still contains placeholder Supabase credentials."
  echo "  Check Vercel env var names/scopes (Production) and redeploy without build cache."
  exit 1
fi

echo "Vercel build OK: credentials embedded in static export."
