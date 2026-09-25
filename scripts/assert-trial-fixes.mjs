import assert from 'node:assert/strict';

import {
  isAcceptableAuthEmail,
  normalizeAuthEmail,
  recoveryParamsFromUrl,
} from '../lib/auth/email.ts';
import { kidAnimalDefaultName } from '../lib/domain/breeding.ts';
import { taskTitleWithGoatName } from '../lib/domain/health.ts';
import { deviceHasSignal, resolveSyncBadge } from '../lib/domain/sync-badge.ts';

assert.equal(kidAnimalDefaultName('Daisy', 1, '2026-03-14'), 'Daisy 26 kid 1');
assert.equal(kidAnimalDefaultName('Daisy', 2, '2025-12-01'), 'Daisy 25 kid 2');
assert.equal(kidAnimalDefaultName('Daisy', 1), 'Daisy kid 1');

assert.equal(
  taskTitleWithGoatName('Meat withdrawal clears — Animal (Safe-Guard)', 'Buttercup'),
  'Meat withdrawal clears — Buttercup (Safe-Guard)',
);
assert.equal(
  taskTitleWithGoatName('Recheck FAMACHA — Animal', 'Clover'),
  'Recheck FAMACHA — Clover',
);
assert.equal(
  taskTitleWithGoatName('Deworm — Animal (FAMACHA 5)', 'Daisy'),
  'Deworm — Daisy (FAMACHA 5)',
);
assert.equal(
  taskTitleWithGoatName('Check water', 'Daisy'),
  'Check water',
);

assert.equal(deviceHasSignal(null), null);
assert.equal(deviceHasSignal({}), null);
assert.equal(deviceHasSignal({ type: 'NONE', isConnected: false }), false);
assert.equal(
  deviceHasSignal({ type: 'UNKNOWN', isConnected: true, isInternetReachable: true }),
  true,
);
assert.equal(
  deviceHasSignal({ type: 'WIFI', isConnected: true, isInternetReachable: false }),
  false,
);

const offlineSaving = resolveSyncBadge({
  failureCount: 0,
  queueCount: 3,
  connected: true,
  uploading: true,
  deviceOnline: false,
});
assert.equal(offlineSaving.kind, 'offline_waiting');
assert.equal(offlineSaving.label, 'Offline · 3 waiting');

const offlineStuckUpload = resolveSyncBadge({
  failureCount: 0,
  queueCount: 0,
  connected: true,
  uploading: true,
  deviceOnline: false,
});
assert.equal(offlineStuckUpload.label, 'Offline · 1 waiting');

const saving = resolveSyncBadge({
  failureCount: 0,
  queueCount: 2,
  connected: true,
  uploading: true,
  deviceOnline: true,
});
assert.equal(saving.label, 'Saving…');

const saved = resolveSyncBadge({
  failureCount: 0,
  queueCount: 0,
  connected: true,
  uploading: false,
  deviceOnline: true,
});
assert.equal(saved.label, 'All saved');

const notSaved = resolveSyncBadge({
  failureCount: 1,
  queueCount: 4,
  connected: false,
  uploading: true,
  deviceOnline: false,
});
assert.equal(notSaved.label, '1 not saved');

assert.equal(normalizeAuthEmail('  Farmer+Herd@Gmail.com '), 'farmer+herd@gmail.com');
assert.equal(
  normalizeAuthEmail("Jane <O'Brien@Farm.COOP>"),
  "o'brien@farm.coop",
);
assert.equal(normalizeAuthEmail('bob@gmail.com'), 'bob@gmail.com');
assert.equal(isAcceptableAuthEmail('bob@gmail.com'), true);
assert.equal(isAcceptableAuthEmail('farmer+herd@gmail.com'), true);
assert.equal(isAcceptableAuthEmail("o'brien@farm.coop"), true);
assert.equal(isAcceptableAuthEmail('farmer@my-farm.farm'), true);
assert.equal(isAcceptableAuthEmail('not-an-email'), false);
assert.equal(isAcceptableAuthEmail('farmer@gmail.com '), false);

const fromHash = recoveryParamsFromUrl(
  'bloodlinebook://reset-password#access_token=aaa&refresh_token=bbb&type=recovery',
);
assert.equal(fromHash.accessToken, 'aaa');
assert.equal(fromHash.refreshToken, 'bbb');
assert.equal(fromHash.code, null);

const fromQuery = recoveryParamsFromUrl(
  'https://app.example.com/reset-password?code=xyz',
);
assert.equal(fromQuery.code, 'xyz');
assert.equal(fromQuery.accessToken, null);

console.log('assert-trial-fixes: ok');
