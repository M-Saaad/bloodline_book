#!/usr/bin/env bash
# Writes .env from Cloud Agent injected secrets (run on each agent boot).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"

cat > "$ENV_FILE" <<EOF
EXPO_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL:-}
EXPO_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}
EXPO_PUBLIC_POWERSYNC_URL=${EXPO_PUBLIC_POWERSYNC_URL:-}
EOF

echo "Wrote $ENV_FILE"
if [[ -z "${EXPO_PUBLIC_POWERSYNC_URL:-}" ]]; then
  echo "WARNING: EXPO_PUBLIC_POWERSYNC_URL is not set. Add it in Cloud Agent environment secrets."
fi
