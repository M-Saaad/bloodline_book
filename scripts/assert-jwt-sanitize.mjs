import assert from 'node:assert/strict';

function sanitizeSupabaseJwtKey(key) {
  const trimmed = key.trim();
  const parts = trimmed.split('.');
  if (
    parts.length === 4 &&
    parts[0] === parts[1] &&
    parts[0].startsWith('eyJ')
  ) {
    return `${parts[0]}.${parts[2]}.${parts[3]}`;
  }
  return trimmed;
}

const header = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
const payload = 'eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIn0';
const signature = 'signature';
const valid = `${header}.${payload}.${signature}`;
const duplicated = `${header}.${header}.${payload}.${signature}`;

assert.equal(sanitizeSupabaseJwtKey(duplicated), valid);
assert.equal(sanitizeSupabaseJwtKey(valid), valid);
assert.equal(sanitizeSupabaseJwtKey(` ${duplicated} `), valid);
console.log('assert-jwt-sanitize: ok');
