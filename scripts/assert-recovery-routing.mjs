import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  shouldRedirectToResetPassword,
  signedInEntryRoute,
} from '../lib/auth/recovery-routing.ts';
import {
  PASSWORD_RESET_REDIRECT_URL,
  SIGNUP_EMAIL_REDIRECT_URL,
  WEB_APP_URL,
} from '../lib/config/app.ts';
import { recoveryLinkErrorFromUrl } from '../lib/auth/recovery.ts';

assert.equal(WEB_APP_URL, 'https://app.bloodlinebookapp.com');
assert.equal(
  PASSWORD_RESET_REDIRECT_URL,
  'https://app.bloodlinebookapp.com/reset-password',
);
assert.equal(SIGNUP_EMAIL_REDIRECT_URL, WEB_APP_URL);

assert.equal(
  signedInEntryRoute({ recoveryPending: false, hasSession: false }),
  'sign-in',
);
assert.equal(
  signedInEntryRoute({ recoveryPending: false, hasSession: true }),
  'app',
);
assert.equal(
  signedInEntryRoute({ recoveryPending: true, hasSession: true }),
  'reset-password',
);
assert.equal(
  signedInEntryRoute({ recoveryPending: true, hasSession: false }),
  'sign-in',
);

assert.equal(
  shouldRedirectToResetPassword({ recoveryPending: false, recoveryLinkError: null }),
  false,
);
assert.equal(
  shouldRedirectToResetPassword({ recoveryPending: true, recoveryLinkError: null }),
  true,
);
assert.equal(
  shouldRedirectToResetPassword({
    recoveryPending: false,
    recoveryLinkError: 'expired',
  }),
  true,
);

assert.match(
  recoveryLinkErrorFromUrl(
    'https://app.bloodlinebookapp.com/reset-password#error=access_denied&error_code=otp_expired',
  ),
  /expired or was already used/i,
);

const root = path.resolve(import.meta.dirname, '..');
const authProvider = fs.readFileSync(
  path.join(root, 'providers/AuthProvider.tsx'),
  'utf8',
);
assert.match(authProvider, /PASSWORD_RESET_REDIRECT_URL/);
assert.doesNotMatch(authProvider, /Linking\.createURL\(\s*['"]\/reset-password['"]\s*\)/);
assert.match(authProvider, /recoveryLinkErrorFromInitialWebUrl/);
assert.match(authProvider, /isRecoveryTypeInInitialWebUrl/);
assert.match(
  authProvider,
  /signInWithPassword[\s\S]*clearRecoveryPending\(\)/,
);

const initialWebUrl = fs.readFileSync(
  path.join(root, 'lib/supabase/initial-web-url.ts'),
  'utf8',
);
assert.match(initialWebUrl, /window\.location\.href/);

const client = fs.readFileSync(path.join(root, 'lib/supabase/client.ts'), 'utf8');
assert.match(client, /from '@\/lib\/supabase\/initial-web-url'/);
const exportIdx = client.indexOf('export { INITIAL_WEB_URL }');
const createIdx = client.indexOf('export const supabase = createClient');
assert.ok(exportIdx !== -1 && createIdx !== -1 && exportIdx < createIdx);

const support = fs.readFileSync(
  path.join(root, 'lib/config/support.ts'),
  'utf8',
);
assert.match(support, /support@bloodlinebookapp\.com/);

console.log('assert-recovery-routing: ok');
