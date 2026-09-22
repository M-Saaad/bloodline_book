#!/usr/bin/env bash
# Copy PowerSync web workers to public/powersync (proxy-safe, no /@ prefix).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

npx --yes @powersync/web copy-assets --output public

if [[ -d "$ROOT/public/@powersync" ]]; then
  mkdir -p "$ROOT/public/powersync"
  cp -a "$ROOT/public/@powersync/." "$ROOT/public/powersync/"
fi
