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

npx --yes @powersync/web copy-assets --output public
npx expo export --platform web
