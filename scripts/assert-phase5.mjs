import assert from 'node:assert/strict';

function uploadFailurePlainReason(errorCode) {
  switch (errorCode) {
    case '42501':
      return "Your role on this farm can't make this change.";
    case '23503':
      return 'This record is linked to other records.';
    default:
      return 'This change could not be saved to the server.';
  }
}

function uploadRowRejectedError(operation) {
  return {
    code: '42501',
    message:
      operation === 'update'
        ? 'Update was rejected by the server.'
        : 'Delete was rejected by the server.',
  };
}

assert.match(
  uploadFailurePlainReason('42501'),
  /can't make this change/,
);
assert.equal(uploadFailurePlainReason('23503').includes('linked'), true);
assert.equal(uploadRowRejectedError('update').code, '42501');
console.log('assert-phase5: ok');
