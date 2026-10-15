/**
 * Browser regression: Add goat form clears after save; edit keeps values; failed save keeps draft.
 * Run with web dev server on :8081:
 *   PLAYWRIGHT_BROWSERS_PATH=0 node scripts/assert-add-animal-form-web.mjs
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
const tagA = `AGF-${suffix}-A`;
const nameA = `AddForm ${suffix} A`;

const results = [];

/** Set when this run creates a throwaway Supabase user (never for supplied demo creds). */
const testCleanup = {
  createdByTest: false,
  admin: null,
  userId: null,
};

function record(name, passed, detail = '') {
  results.push({ name, passed, detail });
  console.log(`${passed ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
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

async function clearAnimalParentLinks(client, farmId) {
  const { error } = await client
    .from('animals')
    .update({ dam_id: null, sire_id: null, litter_id: null })
    .eq('farm_id', farmId);
  if (error) {
    throw new Error(`animals parent links: ${error.message}`);
  }
}

async function cleanupTestUserAndFarms() {
  if (!testCleanup.createdByTest || !testCleanup.admin || !testCleanup.userId) {
    return;
  }

  const admin = testCleanup.admin;
  const userId = testCleanup.userId;

  const { data: memberships, error: memberError } = await admin
    .from('farm_members')
    .select('farm_id')
    .eq('user_id', userId);
  if (memberError) {
    console.warn(`add-animal-form-web cleanup: farm_members: ${memberError.message}`);
    return;
  }

  const farmIds = [...new Set((memberships ?? []).map((row) => row.farm_id).filter(Boolean))];

  for (const farmId of farmIds) {
    try {
      await clearAnimalParentLinks(admin, farmId);
      for (const table of DELETE_TABLE_ORDER) {
        await deleteFarmRowsBatch(admin, table, farmId);
      }
      const { error: farmError } = await admin.from('farms').delete().eq('id', farmId);
      if (farmError) {
        console.warn(`add-animal-form-web cleanup: farms ${farmId}: ${farmError.message}`);
      }
    } catch (error) {
      console.warn(
        `add-animal-form-web cleanup: farm ${farmId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId);
  if (deleteUserError) {
    console.warn(`add-animal-form-web cleanup: deleteUser: ${deleteUserError.message}`);
  }
}

async function resolveCredentials() {
  if (process.env.DEMO_PASSWORD) {
    return {
      email: process.env.DEMO_EMAIL ?? 'demo@bloodlinebook.test',
      password: process.env.DEMO_PASSWORD,
      createdByTest: false,
    };
  }

  loadEnvFile();
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      'Need DEMO_PASSWORD or SUPABASE_SERVICE_ROLE_KEY + Supabase URL for test user bootstrap.',
    );
  }

  const email = `add-form-${suffix}@bloodlinebook.test`;
  const password = randomBytes(32).toString('base64url');
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    throw new Error(`Could not create test user: ${error.message}`);
  }

  testCleanup.createdByTest = true;
  testCleanup.admin = admin;
  testCleanup.userId = data.user.id;

  return { email, password, createdByTest: true };
}

async function ensureFarm(page) {
  const createFarmBtn = page.getByText('Create farm', { exact: true });
  if (await createFarmBtn.isVisible().catch(() => false)) {
    await page
      .getByPlaceholder('e.g. Red Oak Goat Farm')
      .fill(`AGF Farm ${suffix}`);
    await createFarmBtn.click();
    await page.waitForURL(/dashboard/, { timeout: 60000 });
  }
}

async function signIn(page, credentials) {
  await page.goto('http://127.0.0.1:8081/sign-in', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.locator('input').first().waitFor({ state: 'visible', timeout: 45000 });
  const inputs = page.locator('input');
  await inputs.nth(0).fill(credentials.email);
  await inputs.nth(1).fill(credentials.password);
  await page.getByText('Sign In', { exact: true }).last().click();
  await page.waitForURL(/\/(dashboard|create-farm)/, { timeout: 60000 });
  await ensureFarm(page);
  await page.getByText(/All saved/).first().waitFor({ timeout: 120000 });
}

function addGoatUrl(sessionId) {
  const session =
    sessionId ?? `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `http://127.0.0.1:8081/livestock/add?session=${encodeURIComponent(session)}`;
}

async function openAddGoat(page, sessionId) {
  await page.goto(addGoatUrl(sessionId), {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForTimeout(2000);
}

async function clickAddGoatFromDashboard(page) {
  await page.goto('http://127.0.0.1:8081/dashboard', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForTimeout(1000);
  await page.getByText('Add goat', { exact: true }).first().click();
  await page.waitForURL(/\/livestock\/add/, { timeout: 30000 });
  await page.waitForTimeout(1000);
}

async function fieldValueByLabel(page, label) {
  const labelNode = page.getByText(label, { exact: true }).first();
  const container = labelNode.locator('..');
  return container.locator('input').first().inputValue();
}

async function fillFieldByLabel(page, label, value) {
  const labelNode = page.getByText(label, { exact: true }).first();
  const container = labelNode.locator('..');
  await container.locator('input').first().fill(value);
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

try {
  const credentials = await resolveCredentials();
  await signIn(page, credentials);
  record('Sign in', true);

  await openAddGoat(page);
  await fillFieldByLabel(page, 'Name', nameA);
  await fillFieldByLabel(page, 'Tag number', tagA);
  await page.getByText('Save goat', { exact: true }).click();
  await page.waitForFunction(
    () => !window.location.pathname.endsWith('/livestock/add'),
    { timeout: 45000 },
  );

  await clickAddGoatFromDashboard(page);
  const nameAfterSave = await fieldValueByLabel(page, 'Name');
  const tagAfterSave = await fieldValueByLabel(page, 'Tag number');
  const freshAfterSave = nameAfterSave === '' && tagAfterSave === '';
  record(
    'Add goat fresh after successful save (online)',
    freshAfterSave,
    `name="${nameAfterSave}" tag="${tagAfterSave}"`,
  );
  await page.screenshot({
    path: `${artifactsDir}/add-goat-fresh-after-save-online.png`,
    fullPage: true,
  });

  await page.goto('http://127.0.0.1:8081/livestock', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder('Name or tag number').fill(tagA);
  await page.waitForTimeout(800);
  await page.getByText(`#${tagA}`, { exact: false }).first().click();
  await page.waitForTimeout(1200);
  await page.getByText('Edit Animal', { exact: true }).click();
  await page.waitForURL(/\/livestock\/edit\//, { timeout: 20000 });
  const editName = await fieldValueByLabel(page, 'Name');
  const editTag = await fieldValueByLabel(page, 'Tag number');
  record(
    'Edit goat shows saved values',
    editName === nameA && editTag === tagA,
    `name="${editName}" tag="${editTag}"`,
  );

  await openAddGoat(page);
  await fillFieldByLabel(page, 'Name', 'Draft goat');
  await fillFieldByLabel(page, 'Tag number', 'draft-only');
  const exactPct = page.getByText('Exact percentage', { exact: true }).first();
  await exactPct.scrollIntoViewIfNeeded();
  await exactPct.locator('..').locator('input').first().fill('150');
  await page.getByText('Save goat', { exact: true }).click();
  await page.waitForTimeout(1500);
  const stillOnAdd = page.url().includes('/livestock/add');
  const draftName = await fieldValueByLabel(page, 'Name');
  const draftTag = await fieldValueByLabel(page, 'Tag number');
  record(
    'Failed save keeps entered values',
    stillOnAdd && draftName === 'Draft goat' && draftTag === 'draft-only',
    `onAdd=${stillOnAdd} name="${draftName}"`,
  );

  await fillFieldByLabel(page, 'Name', 'Picker draft');
  await fillFieldByLabel(page, 'Tag number', 'picker-draft');
  const dobOpen = page.getByText('Select date', { exact: true }).first();
  await dobOpen.scrollIntoViewIfNeeded();
  await dobOpen.click();
  await page.waitForTimeout(500);
  await page.getByText('Done', { exact: true }).click();
  await page.waitForTimeout(500);
  const nameAfterPicker = await fieldValueByLabel(page, 'Name');
  const tagAfterPicker = await fieldValueByLabel(page, 'Tag number');
  record(
    'Date picker return keeps draft values',
    nameAfterPicker === 'Picker draft' && tagAfterPicker === 'picker-draft',
    `name="${nameAfterPicker}" tag="${tagAfterPicker}"`,
  );

  const routeSession = `route-blur-${suffix}`;
  await openAddGoat(page, routeSession);
  const activeSession = routeSession;
  await fillFieldByLabel(page, 'Name', 'Route blur draft');
  await fillFieldByLabel(page, 'Tag number', 'route-blur');
  await page.getByText('Herd', { exact: true }).click();
  await page.waitForURL(/\/livestock\/?(\?|$)/, { timeout: 20000 });
  await page.goBack();
  await page.waitForURL(/\/livestock\/add/, { timeout: 20000 });
  const nameAfterRouteBlur = await fieldValueByLabel(page, 'Name');
  const tagAfterRouteBlur = await fieldValueByLabel(page, 'Tag number');
  record(
    'Route blur and return keeps draft (same session)',
    nameAfterRouteBlur === 'Route blur draft' &&
      tagAfterRouteBlur === 'route-blur' &&
      page.url().includes(`session=${encodeURIComponent(activeSession)}`),
    `name="${nameAfterRouteBlur}" url=${page.url()}`,
  );

  await page.getByText('Herd', { exact: true }).click();
  await page.waitForURL(/\/livestock\/?(\?|$)/, { timeout: 20000 });
  await clickAddGoatFromDashboard(page);
  const nameNewSession = await fieldValueByLabel(page, 'Name');
  const tagNewSession = await fieldValueByLabel(page, 'Tag number');
  record(
    'New add session clears previous draft',
    nameNewSession === '' && tagNewSession === '',
    `name="${nameNewSession}" tag="${tagNewSession}"`,
  );

  const tagB = `AGF-${suffix}-B`;
  const nameB = `AddForm ${suffix} B`;
  await page.goto('http://127.0.0.1:8081/dashboard', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(1500);
  await context.setOffline(true);
  await page.getByText('Add goat', { exact: true }).first().click();
  await page.waitForURL(/\/livestock\/add/, { timeout: 30000 });
  await fillFieldByLabel(page, 'Name', nameB);
  await fillFieldByLabel(page, 'Tag number', tagB);
  await page.getByText('Save goat', { exact: true }).click();
  await page.waitForFunction(
    () => !window.location.pathname.endsWith('/livestock/add'),
    { timeout: 90000 },
  );
  await page.getByText('Add goat', { exact: true }).first().click();
  await page.waitForURL(/\/livestock\/add/, { timeout: 30000 });
  const offlineFresh =
    (await fieldValueByLabel(page, 'Name')) === '' &&
    (await fieldValueByLabel(page, 'Tag number')) === '';
  record('Add goat fresh after offline save', offlineFresh);
  await page.screenshot({
    path: `${artifactsDir}/add-goat-fresh-after-save-offline.png`,
    fullPage: true,
  });
  await context.setOffline(false);

  writeFileSync(
    `${artifactsDir}/add-animal-form-web-results.json`,
    JSON.stringify({ results, tagA, tagB }, null, 2),
  );

  const failed = results.filter((r) => !r.passed);
  if (failed.length > 0) {
    await page.screenshot({
      path: `${artifactsDir}/add-animal-form-web-fatal.png`,
      fullPage: true,
    });
    process.exitCode = 1;
  } else {
    console.log('assert-add-animal-form-web: all checks passed');
  }
} finally {
  await context.setOffline(false).catch(() => {});
  await browser.close();
  await cleanupTestUserAndFarms();
}
