#!/usr/bin/env bash
# Vercel build: static Expo web export with PowerSync worker assets.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

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

# Same JWT-header duplication as scripts/setup-env.sh (Cloud / Vercel secrets).
if [[ -n "${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}" ]]; then
  _key="$EXPO_PUBLIC_SUPABASE_ANON_KEY"
  IFS='.' read -r -a _parts <<< "$_key"
  if [[ ${#_parts[@]} -eq 4 && "${_parts[0]}" == "${_parts[1]}" && "${_parts[0]}" == eyJ* ]]; then
    export EXPO_PUBLIC_SUPABASE_ANON_KEY="${_parts[0]}.${_parts[2]}.${_parts[3]}"
    echo "Sanitized duplicated JWT header on EXPO_PUBLIC_SUPABASE_ANON_KEY"
  fi
  unset _key _parts
fi

npx --yes @powersync/web copy-assets --output public
npx expo export --platform web
