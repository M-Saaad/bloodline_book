/**
 * End-to-end pilot flow audit (web stand-in for phone pilot).
 *
 * Flow: create farm → add goats → find by tag/name → record health event offline
 * → reload (close/reopen) → reconnect → verify server has exactly one row.
 * Also exercises forgot-password UI and recovery-link password update.
 *
 * Run with Expo web on :8081:
 *   PLAYWRIGHT_BROWSERS_PATH=0 node scripts/pilot-flow-audit.mjs
 */
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

import { DELETE_TABLE_ORDER } from './admin-delete-farm.mjs';

const require = createRequire(import.meta.url);
const playwrightPath =
  process.env.PLAYWRIGHT_MODULE ?? resolve(process.cwd(), 'node_modules/playwright');
const { chromium } = require(playwrightPath);

const artifactsDir = '/opt/cursor/artifacts';
mkdirSync(artifactsDir, { recursive: true });

const suffix = String(Date.now()).slice(-6);
const farmName = `Pilot Audit ${suffix}`;
const goatName = `Pilot Goat ${suffix}`;
const goatTag = `PA-${suffix}`;
const goatNameB = `Pilot B ${suffix}`;
const goatTagB = `PB-${suffix}`;
const healthNote = `pilot-audit-offline-${suffix}`;

/** @type {{ step: string, status: 'PASS' | 'FAIL' | 'NOT TESTED', detail?: string, artifact?: string }[]} */
const report = [];

const testCleanup = {
  admin: null,
  userId: null,
  farmId: null,
  email: null,
};

function record(step, status, detail = '', artifact = '') {
  report.push({ step, status, detail, artifact });
  const mark = status === 'PASS' ? 'PASS' : status === 'FAIL' ? 'FAIL' : 'NOT TESTED';
  console.log(`${mark}: ${step}${detail ? ` — ${detail}` : ''}`);
}

function loadEnvFile() {
  const path = resolve(process.cwd(), '.env');
  try {
    const raw = readFileSync(path, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq);
      const value = trimmed.slice(eq + 1);
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // optional
  }
}

function supabaseAdmin() {
  loadEnvFile();
  const url =
    process.env.SUPABASE_URL?.trim() ??
    process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ??
    '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
  if (!url || !serviceKey) {
    throw new Error('Need SUPABASE_SERVICE_ROLE_KEY and Supabase URL in .env or shell.');
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function deleteFarmRowsBatch(client, table, farmId) {
  for (;;) {
    const { data, error } = await client
      .from(table)
      .delete()
      .eq('farm_id', farmId)
      .select('farm_id');
    if (error) {
      throw new Error(`${table}: ${error.message}`);
    }
    if ((data?.length ?? 0) === 0) {
      return;
    }
  }
}

async function cleanup() {
  if (!testCleanup.admin || !testCleanup.userId) {
    return;
  }
  const admin = testCleanup.admin;
  const userId = testCleanup.userId;

  const { data: memberships } = await admin
    .from('farm_members')
    .select('farm_id')
    .eq('user_id', userId);
  const farmIds = [
    ...new Set(
      [testCleanup.farmId, ...(memberships ?? []).map((row) => row.farm_id)].filter(Boolean),
    ),
  ];

  for (const farmId of farmIds) {
    try {
      await admin
        .from('animals')
        .update({ dam_id: null, sire_id: null, litter_id: null })
        .eq('farm_id', farmId);
      for (const table of DELETE_TABLE_ORDER) {
        await deleteFarmRowsBatch(admin, table, farmId);
      }
      await admin.from('farms').delete().eq('id', farmId);
    } catch (error) {
      console.warn(
        `pilot-flow-audit cleanup farm ${farmId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  await admin.auth.admin.deleteUser(userId).catch(() => {});
}

async function bootstrapUser() {
  const admin = supabaseAdmin();
  const email = `pilot-audit-${suffix}@bloodlinebook.test`;
  const password = `Pilot-${randomBytes(16).toString('base64url')}-Aa1`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    record('Bootstrap pilot test user', 'FAIL', error.message);
    throw error;
  }
  testCleanup.admin = admin;
  testCleanup.userId = data.user.id;
  testCleanup.email = email;
  record('Bootstrap pilot test user', 'PASS', email);
  return { admin, email, password };
}

async function signIn(page, email, password) {
  await page.goto('http://127.0.0.1:8081/sign-in', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.locator('input').first().waitFor({ state: 'visible', timeout: 45000 });
  const inputs = page.locator('input');
  await inputs.nth(0).fill(email);
  await inputs.nth(1).fill(password);
  await page.getByText('Sign In', { exact: true }).last().click();
  await page.waitForURL(/\/(dashboard|create-farm)/, { timeout: 60000 });
}

async function waitForAllSaved(page, timeoutMs = 120000) {
  await page
    .getByText(/All saved/)
    .first()
    .waitFor({ timeout: timeoutMs });
}

async function badgeShowsAllSaved(page) {
  const byA11y = page.locator('[accessibilitylabel="All saved"]');
  if (await byA11y.count()) {
    return true;
  }
  const text = await page.getByText(/All saved/).first().isVisible().catch(() => false);
  return text;
}

function labeledInput(page, label) {
  return page
    .getByText(label, { exact: true })
    .locator('visible=true')
    .last()
    .locator('..')
    .locator('input')
    .first();
}

async function fillFieldByLabel(page, label, value) {
  const input = labeledInput(page, label);
  await input.scrollIntoViewIfNeeded();
  await input.fill(value);
}

async function syncBadgeText(page) {
  const badge = page.locator('[accessibilitylabel]').filter({
    hasText: /All saved|Saving|Offline|not saved/,
  });
  const count = await badge.count();
  if (count === 0) {
    return await page
      .getByText(/All saved|Saving…|Offline ·|not saved/)
      .first()
      .innerText()
      .catch(() => '');
  }
  return await badge.first().getAttribute('accessibilitylabel');
}

async function assertNeverAllSavedWhilePending(page, durationMs = 4000) {
  const start = Date.now();
  while (Date.now() - start < durationMs) {
    const label = await syncBadgeText(page);
    if (label === 'All saved' || (label && /All saved/.test(label))) {
      return false;
    }
    await page.waitForTimeout(400);
  }
  return true;
}

async function resolveFarmId(admin, userId, name) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const { data: members, error } = await admin
      .from('farm_members')
      .select('farm_id')
      .eq('user_id', userId);
    if (error) {
      throw new Error(error.message);
    }
    const ids = [...new Set((members ?? []).map((row) => row.farm_id).filter(Boolean))];
    if (ids.length > 0) {
      const { data: farms } = await admin
        .from('farms')
        .select('id')
        .in('id', ids)
        .eq('name', name);
      if (farms?.[0]?.id) {
        return farms[0].id;
      }
      return ids[0];
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 2000));
  }
  return null;
}

async function dismissDevErrorToast(page) {
  await page
    .evaluate(() => {
      document.getElementById('error-toast')?.remove();
    })
    .catch(() => {});
}

async function clickBottomTab(page, label) {
  await dismissDevErrorToast(page);
  await page.getByRole('button', { name: label }).click();
  await page.waitForTimeout(900);
}

async function openHealthLogInApp(page) {
  await clickBottomTab(page, 'More');
  await page.getByRole('button', { name: /Health log/ }).click();
  await page.waitForTimeout(1200);
}

async function ensureAppShellOnline(page, context) {
  await context.setOffline(false);
  if (!page.url().includes('127.0.0.1:8081')) {
    await page.goto('http://127.0.0.1:8081/more/health', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.waitForTimeout(2000);
  }
}

async function countHealthNotes(admin, farmId, note) {
  const { data, error } = await admin
    .from('health_records')
    .select('id')
    .eq('farm_id', farmId)
    .eq('notes', note);
  if (error) {
    throw new Error(error.message);
  }
  return data?.length ?? 0;
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
});
await context.addInitScript(() => {
  localStorage.setItem('bloodline.textSizeOnboarding.v1', '1');
  localStorage.setItem('bloodline.textSize.v2', 'default');
});
const page = await context.newPage();

let credentials;
let farmId = null;

try {
  credentials = await bootstrapUser();
  await signIn(page, credentials.email, credentials.password);
  record('Sign in (new pilot account)', 'PASS');

  const onCreateFarm = page.url().includes('create-farm');
  if (onCreateFarm) {
    await page.getByPlaceholder('e.g. Red Oak Goat Farm').fill(farmName);
    await page.getByText('Create farm', { exact: true }).click();
    await page.waitForURL(/dashboard/, { timeout: 60000 });
    record('Create farm', 'PASS', farmName);
  } else {
    record('Create farm', 'FAIL', `Expected create-farm, got ${page.url()}`);
  }

  await waitForAllSaved(page);
  await page.screenshot({ path: `${artifactsDir}/pilot-audit-farm.png` });

  await page.goto('http://127.0.0.1:8081/livestock/add', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(1500);
  await fillFieldByLabel(page, 'Name', goatName);
  await fillFieldByLabel(page, 'Tag number', goatTag);
  await page.getByRole('button', { name: 'Save goat' }).last().click();
  await page.waitForFunction(
    () => !window.location.pathname.endsWith('/livestock/add'),
    { timeout: 45000 },
  );
  record('Add goat (primary)', 'PASS', `${goatName} / ${goatTag}`);

  await page.goto('http://127.0.0.1:8081/livestock/add', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(1500);
  await fillFieldByLabel(page, 'Name', goatNameB);
  await fillFieldByLabel(page, 'Tag number', goatTagB);
  await page.getByRole('button', { name: 'Save goat' }).last().click();
  await page.waitForFunction(
    () => !window.location.pathname.endsWith('/livestock/add'),
    { timeout: 45000 },
  );
  record('Add goat (second)', 'PASS', `${goatNameB} / ${goatTagB}`);

  await waitForAllSaved(page, 90000);

  farmId = await resolveFarmId(credentials.admin, testCleanup.userId, farmName);
  testCleanup.farmId = farmId;
  record(
    'Farm synced to server (farm_id resolved)',
    farmId ? 'PASS' : 'FAIL',
    farmId ?? 'missing',
  );

  await page.goto('http://127.0.0.1:8081/livestock', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(1200);
  await page.getByPlaceholder('Name or tag number').fill(goatTag);
  await page.waitForTimeout(600);
  const tagHit = await page.getByText(`#${goatTag}`, { exact: false }).first().isVisible();
  const otherHidden = (await page.getByText(`#${goatTagB}`, { exact: false }).count()) === 0;
  record(
    'Find goat by tag (herd list)',
    tagHit && otherHidden ? 'PASS' : 'FAIL',
    `tagVisible=${tagHit} filteredOther=${otherHidden}`,
    'pilot-audit-find-tag.png',
  );
  await page.screenshot({ path: `${artifactsDir}/pilot-audit-find-tag.png` });

  await page.goto('http://127.0.0.1:8081/more/health/add', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(1200);
  await page.getByText('Not set', { exact: true }).click();
  await page.waitForTimeout(500);
  const search = page.getByPlaceholder('Search name, tag, or registration').first();
  await search.waitFor({ timeout: 15000 });
  await search.fill(goatName);
  await page.waitForTimeout(500);
  const pickerRow = page.getByText(new RegExp(`${goatName}`)).first();
  const namePickerVisible = await pickerRow.isVisible().catch(() => false);
  record(
    'Find goat by name (health picker)',
    namePickerVisible ? 'PASS' : 'FAIL',
    `picker=${namePickerVisible}`,
    'pilot-audit-find-name.png',
  );
  await page.screenshot({ path: `${artifactsDir}/pilot-audit-find-name.png` });
  await pickerRow.click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Other' }).first().click();
  await page.getByPlaceholder('Optional').last().fill(healthNote);

  await waitForAllSaved(page, 60000);
  await context.setOffline(true);
  await page.waitForTimeout(1000);

  await page.getByText('Save health record', { exact: true }).click();
  await page.waitForFunction(
    () => !window.location.pathname.includes('/health/add'),
    { timeout: 45000 },
  );
  await page.waitForTimeout(1500);

  const offlineLabel = await syncBadgeText(page);
  const offlineOk = /Offline · \d+ waiting/.test(offlineLabel ?? '');
  record(
    'Offline: badge shows waiting (not All saved)',
    offlineOk ? 'PASS' : 'FAIL',
    offlineLabel ?? '',
    'pilot-audit-offline-badge.png',
  );
  await page.screenshot({ path: `${artifactsDir}/pilot-audit-offline-badge.png` });

  const noFalseAllSaved = await assertNeverAllSavedWhilePending(page, 5000);
  record(
    'Offline: never shows All saved while queue pending',
    noFalseAllSaved ? 'PASS' : 'FAIL',
  );

  async function healthListShowsOfflineRecord() {
    await openHealthLogInApp(page);
    const row = page.locator('div').filter({ hasText: healthNote }).locator('visible=true');
    await row.first().waitFor({ timeout: 25000 });
    return (await row.count()) > 0;
  }

  let localNoteVisible = await healthListShowsOfflineRecord();
  await clickBottomTab(page, 'Today');
  localNoteVisible = await healthListShowsOfflineRecord();
  record(
    'Close/reopen (in-app): health list still shows offline record while offline',
    localNoteVisible ? 'PASS' : 'FAIL',
    `visible=${localNoteVisible} (full app kill/reopen needs installed PWA or native — see manual list)`,
    'pilot-audit-after-reload-offline.png',
  );
  await page.screenshot({ path: `${artifactsDir}/pilot-audit-after-reload-offline.png` });

  const serverCountOffline = farmId ? await countHealthNotes(credentials.admin, farmId, healthNote) : -1;
  record(
    'Offline: server row count before reconnect',
    serverCountOffline === 0 ? 'PASS' : 'FAIL',
    `count=${serverCountOffline}`,
  );

  await ensureAppShellOnline(page, context);
  await page.waitForTimeout(1500);
  await waitForAllSaved(page, 120000);
  record('Reconnect: badge reaches All saved', 'PASS', '', 'pilot-audit-all-saved.png');
  await page.screenshot({ path: `${artifactsDir}/pilot-audit-all-saved.png` });

  await page.waitForTimeout(3000);
  const serverCountOnline = farmId ? await countHealthNotes(credentials.admin, farmId, healthNote) : -1;
  record(
    'Sync: health record uploaded exactly once',
    serverCountOnline === 1 ? 'PASS' : 'FAIL',
    `count=${serverCountOnline}`,
  );

  await openHealthLogInApp(page);
  await clickBottomTab(page, 'More');
  await page.getByRole('button', { name: 'Sign out' }).first().click();
  await page.waitForURL(/sign-in/, { timeout: 60000 });
  await page.locator('input').first().waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('input').nth(0).fill(credentials.email);
  await page.getByText('Forgot password?', { exact: true }).click();
  const forgotMsg = await page
    .getByText('Check your email for a password reset link.', { exact: false })
    .waitFor({ timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  record(
    'Password recovery: forgot-password sends confirmation',
    forgotMsg ? 'PASS' : 'FAIL',
    `message=${forgotMsg}`,
    'pilot-audit-forgot-password.png',
  );
  await page.screenshot({ path: `${artifactsDir}/pilot-audit-forgot-password.png` });

  const newPassword = `Reset-${randomBytes(12).toString('base64url')}-Bb2`;
  const { data: linkData, error: linkError } = await credentials.admin.auth.admin.generateLink({
    type: 'recovery',
    email: credentials.email,
    options: { redirectTo: 'http://127.0.0.1:8081/reset-password' },
  });
  if (linkError || !linkData?.properties?.action_link) {
    record('Password recovery: admin recovery link', 'FAIL', linkError?.message ?? 'no link');
  } else {
    await page.goto(linkData.properties.action_link, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.waitForURL(/reset-password/, { timeout: 60000 });
    await page
      .getByText('Choose a new password', { exact: false })
      .waitFor({ timeout: 90000 });
    const pwdInputs = page.locator('input');
    await pwdInputs.nth(0).waitFor({ state: 'visible', timeout: 30000 });
    await pwdInputs.nth(0).fill(newPassword);
    await pwdInputs.nth(1).fill(newPassword);
    await page.getByText('Update password', { exact: true }).click();
    await page.waitForURL(/dashboard|livestock|create-farm/, { timeout: 90000 });
    await clickBottomTab(page, 'More');
    await page.getByRole('button', { name: 'Sign out' }).first().click();
    await page.waitForURL(/sign-in/, { timeout: 60000 });
    await page.locator('input').nth(0).waitFor({ state: 'visible', timeout: 30000 });
    await page.locator('input').nth(0).fill(credentials.email);
    await page.locator('input').nth(1).fill(newPassword);
    await page.getByText('Sign In', { exact: true }).last().click();
    const signedIn = await page
      .waitForURL(/dashboard|livestock|more/, { timeout: 60000 })
      .then(() => true)
      .catch(() => false);
    record(
      'Password recovery: reset link sets new password and sign-in works',
      signedIn ? 'PASS' : 'FAIL',
      `signedIn=${signedIn}`,
      'pilot-audit-recovery-complete.png',
    );
    await page.screenshot({ path: `${artifactsDir}/pilot-audit-recovery-complete.png` });
    credentials.password = newPassword;
  }
} catch (error) {
  record(
    'Pilot flow audit script',
    'FAIL',
    error instanceof Error ? error.message : String(error),
    'pilot-audit-failure.png',
  );
  await page.screenshot({ path: `${artifactsDir}/pilot-audit-failure.png`, fullPage: true }).catch(
    () => {},
  );
} finally {
  await context.setOffline(false).catch(() => {});
  await browser.close();
  await cleanup();
}

const reportPath = `${artifactsDir}/pilot-flow-audit-report.json`;
writeFileSync(reportPath, JSON.stringify({ suffix, report }, null, 2));

const failed = report.filter((row) => row.status === 'FAIL');
const passed = report.filter((row) => row.status === 'PASS');
console.log(`\nSummary: ${passed.length} PASS, ${failed.length} FAIL, ${report.length} steps`);
console.log(`Report: ${reportPath}`);
if (failed.length) {
  process.exitCode = 1;
}
