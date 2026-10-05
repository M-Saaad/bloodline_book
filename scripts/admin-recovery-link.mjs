#!/usr/bin/env node
/**
 * Generate a password-recovery link for an existing auth user (admin only).
 *
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the shell environment ONLY.
 * Do not load .env. Never store the service role key in .env, git, or EXPO_PUBLIC_*.
 *
 * Usage: node scripts/admin-recovery-link.mjs farmer@example.com
 */

import { createClient } from '@supabase/supabase-js';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const emailArg = process.argv[2];

function usage() {
  console.error('Usage: node scripts/admin-recovery-link.mjs <email>');
  console.error('');
  console.error(
    'Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the shell (not in .env).',
  );
  console.error(
    'Never put the service role key in .env or any EXPO_PUBLIC_* variable.',
  );
}

if (!emailArg || emailArg.startsWith('-')) {
  usage();
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY.');
  usage();
  process.exit(1);
}

let parsedUrl;
try {
  parsedUrl = new URL(supabaseUrl);
} catch {
  console.error('SUPABASE_URL is not a valid URL.');
  process.exit(1);
}

const rl = createInterface({ input, output });
console.log(`Supabase project URL: ${parsedUrl.origin}`);
console.log(
  'This uses the service role key from your shell and can generate recovery links for any user.',
);
const answer = await rl.question('Type yes to continue: ');
rl.close();

if (answer.trim().toLowerCase() !== 'yes') {
  console.error('Aborted.');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const email = emailArg.trim();

const { data, error } = await admin.auth.admin.generateLink({
  type: 'recovery',
  email,
});

if (error) {
  if (/user.*not found|not found/i.test(error.message)) {
    console.error(`No Supabase Auth user exists for: ${email}`);
    process.exit(1);
  }
  console.error(error.message);
  process.exit(1);
}

const actionLink = data?.properties?.action_link;
if (!actionLink) {
  console.error('Recovery link was not returned.');
  process.exit(1);
}

console.log(actionLink);
