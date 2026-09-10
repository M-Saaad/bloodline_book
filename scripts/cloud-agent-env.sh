#!/usr/bin/env bash
# Print `export` lines that sanitize Cloud Agent secrets for Next.js and db scripts.
# Usage: eval "$(bash scripts/cloud-agent-env.sh)"
set -euo pipefail
python3 - <<'PY'
import os
import shlex
from urllib.parse import urlparse, quote

def emit(key: str, value: str) -> None:
    print(f"export {key}={shlex.quote(value)}")

def normalize_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme and parsed.netloc:
        return f"{parsed.scheme}://{parsed.netloc}"
    return url.replace("/rest/v1", "").rstrip("/")

def normalize_jwt(token: str) -> str:
    parts = token.split(".")
    if len(parts) == 4 and parts[0] == parts[1]:
        return f"{parts[0]}.{parts[2]}.{parts[3]}"
    return token

def encode_postgres_url(raw: str) -> str:
    trimmed = raw.strip()
    try:
        parsed = urlparse(trimmed)
        if parsed.hostname:
            return trimmed
    except Exception:
        pass
    scheme, sep, rest = trimmed.partition("://")
    if not sep:
        return trimmed
    last_at = rest.rfind("@")
    if last_at < 0:
        return trimmed
    creds, hostpart = rest[:last_at], rest[last_at + 1 :]
    user, _, password = creds.partition(":")
    return f"{scheme}://{quote(user, safe='')}:{quote(password, safe='')}@{hostpart}"

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
if url:
    emit("NEXT_PUBLIC_SUPABASE_URL", normalize_url(url))

for key in ("NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"):
    value = os.environ.get(key)
    if value:
        emit(key, normalize_jwt(value))

db = os.environ.get("DATABASE_URL") or os.environ.get("BLOODLINEBOOK_DATABASE_URL")
if db:
    encoded = encode_postgres_url(db)
    emit("DATABASE_URL", encoded)
    emit("BLOODLINEBOOK_DATABASE_URL", encoded)
PY
