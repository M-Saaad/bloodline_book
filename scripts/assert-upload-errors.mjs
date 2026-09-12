import assert from 'node:assert/strict';

function formatUploadError(error) {
  if (error instanceof Error && error.message && error.message !== '[object Object]') {
    return error.message;
  }
  if (typeof error === 'object' && error !== null) {
    const record = error;
    const message =
      (typeof record.message === 'string' && record.message) ||
      (typeof record.msg === 'string' && record.msg) ||
      null;
    const code = typeof record.code === 'string' ? record.code : null;
    if (message && code) return `${message} (code ${code})`;
    if (message) return message;
  }
  return String(error);
}

const postgrest = {
  code: '42501',
  message: 'new row violates row-level security policy for table "farms"',
};

assert.equal(
  formatUploadError(postgrest),
  'new row violates row-level security policy for table "farms" (code 42501)',
);
assert.notEqual(formatUploadError(postgrest), '[object Object]');
console.log('assert-upload-errors: ok');
