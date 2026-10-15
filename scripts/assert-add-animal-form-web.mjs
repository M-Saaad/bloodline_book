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

async function clickHerdTab(page) {
  await page.getByText('Herd', { exact: true }).last().click();
  await page.waitForTimeout(600);
}

async function clickTodayTab(page) {
  await page.getByText('Today', { exact: true }).last().click();
  await page.waitForTimeout(600);
}

/** In-app navigation only (works offline once the SPA is loaded). */
async function clickAddGoatFromDashboard(page) {
  await clickTodayTab(page);
  await page.waitForURL(/\/dashboard/, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Add goat' }).first().click();
  await page.waitForURL(/\/livestock\/add/, { timeout: 30000 });
  await page.waitForTimeout(1000);
}

async function clickHeaderBack(page) {
  await page.getByRole('button', { name: 'Back' }).click();
  await page.waitForTimeout(500);
}

async function openQuickAdd(page) {
  await page.getByRole('button', { name: 'Quick add' }).click();
  await page.waitForTimeout(500);
}

async function clickKeepEditing(page) {
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await page.waitForTimeout(400);
}

async function clickDiscardGoat(page) {
  await page.getByRole('button', { name: 'Discard' }).click();
  await page.waitForTimeout(800);
}

async function discardAddGoatDraftIfPrompted(page) {
  const visible = await page
    .getByText('Discard this goat?', { exact: true })
    .waitFor({ state: 'visible', timeout: 3000 })
    .then(() => true)
    .catch(() => false);
  if (!visible) {
    return false;
  }
  await clickDiscardGoat(page);
  return true;
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

async function fieldValueByLabel(page, label) {
  return labeledInput(page, label).inputValue();
}

async function fillFieldByLabel(page, label, value) {
  const input = labeledInput(page, label);
  await input.scrollIntoViewIfNeeded();
  await input.fill(value);
}

async function clickSaveGoat(page) {
  await page.getByRole('button', { name: 'Save goat' }).locator('visible=true').last().click();
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
  await clickSaveGoat(page);
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
  await clickSaveGoat(page);
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

  await clickHerdTab(page);
  await discardAddGoatDraftIfPrompted(page);

  await clickAddGoatFromDashboard(page);
  await clickHerdTab(page);
  const untouchedDialog = await page
    .getByText('Discard this goat?', { exact: true })
    .isVisible()
    .catch(() => false);
  record(
    'Untouched add: Herd tab leaves without discard dialog',
    !untouchedDialog && !page.url().includes('/livestock/add'),
    `onAdd=${page.url().includes('/livestock/add')}`,
  );

  await clickAddGoatFromDashboard(page);
  const urlBeforeHeaderBack = page.url();
  await fillFieldByLabel(page, 'Name', 'Stable draft');
  await fillFieldByLabel(page, 'Tag number', 'stable-tag');
  await clickHeaderBack(page);
  const backDialog = await page
    .getByText('Discard this goat?', { exact: true })
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  const urlDuringDialog = page.url();
  const nameDuringDialog = await fieldValueByLabel(page, 'Name');
  const tagDuringDialog = await fieldValueByLabel(page, 'Tag number');
  record(
    'Header back: route and fields unchanged while dialog open (online)',
    backDialog &&
      urlDuringDialog === urlBeforeHeaderBack &&
      nameDuringDialog === 'Stable draft' &&
      tagDuringDialog === 'stable-tag',
    `dialog=${backDialog} urlMatch=${urlDuringDialog === urlBeforeHeaderBack}`,
  );
  if (backDialog) {
    await clickKeepEditing(page);
  }
  const nameAfterBackKeep = await fieldValueByLabel(page, 'Name');
  const tagAfterBackKeep = await fieldValueByLabel(page, 'Tag number');
  record(
    'Header back + Keep editing preserves all fields (online)',
    backDialog &&
      nameAfterBackKeep === 'Stable draft' &&
      tagAfterBackKeep === 'stable-tag' &&
      page.url() === urlBeforeHeaderBack,
    `name="${nameAfterBackKeep}" url=${page.url()}`,
  );

  await clickHeaderBack(page);
  const backDiscardDialog = await page
    .getByText('Discard this goat?', { exact: true })
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (backDiscardDialog) {
    await clickDiscardGoat(page);
  }
  await page.waitForFunction(
    () => !window.location.pathname.endsWith('/livestock/add'),
    { timeout: 10000 },
  );
  record(
    'Header back + Discard leaves add once (online)',
    backDiscardDialog && !page.url().includes('/livestock/add'),
    `url=${page.url()}`,
  );

  await clickAddGoatFromDashboard(page);
  await fillFieldByLabel(page, 'Name', 'Quick add draft');
  await fillFieldByLabel(page, 'Tag number', 'quick-draft');
  await openQuickAdd(page);
  const urlBeforeQuick = page.url();
  await page.getByText('Weigh goats', { exact: true }).click();
  const quickDialog = await page
    .getByText('Discard this goat?', { exact: true })
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (quickDialog) {
    await clickKeepEditing(page);
  }
  await page.waitForFunction(
    () => window.location.pathname.includes('/livestock/add'),
    { timeout: 5000 },
  );
  const quickSheetOpen = await page
    .getByText('What did you do?', { exact: true })
    .isVisible()
    .catch(() => false);
  const quickName = await fieldValueByLabel(page, 'Name');
  const stayedOnAdd = page.url().includes('/livestock/add') && page.url() === urlBeforeQuick;
  record(
    'Quick add + Keep editing preserves draft (online)',
    quickDialog &&
      !quickSheetOpen &&
      quickName === 'Quick add draft' &&
      stayedOnAdd,
    `dialog=${quickDialog} sheet=${quickSheetOpen} name="${quickName}" url=${page.url()}`,
  );

  await openQuickAdd(page);
  await page.getByText('Treatment', { exact: true }).click();
  const quickDiscardDialog = await page
    .getByText('Discard this goat?', { exact: true })
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (quickDiscardDialog) {
    await page.getByText('Discard', { exact: true }).click();
    await page.waitForTimeout(800);
  }
  record(
    'Quick add + Discard navigates away (online)',
    quickDiscardDialog && !page.url().includes('/livestock/add'),
    `url=${page.url()}`,
  );

  await clickAddGoatFromDashboard(page);
  await fillFieldByLabel(page, 'Name', 'Tab draft');
  await fillFieldByLabel(page, 'Tag number', 'tab-draft');
  await clickHerdTab(page);
  const dialogVisible = await page
    .getByText('Discard this goat?', { exact: true })
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (dialogVisible) {
    await page.getByText('Keep editing', { exact: true }).click();
    await page.waitForTimeout(400);
  }
  const nameAfterKeep = await fieldValueByLabel(page, 'Name');
  const tagAfterKeep = await fieldValueByLabel(page, 'Tag number');
  record(
    'Herd tab + Keep editing preserves draft (online)',
    dialogVisible &&
      nameAfterKeep === 'Tab draft' &&
      tagAfterKeep === 'tab-draft' &&
      page.url().includes('/livestock/add'),
    `dialog=${dialogVisible} name="${nameAfterKeep}"`,
  );

  await clickHerdTab(page);
  const dialogAgain = await page
    .getByText('Discard this goat?', { exact: true })
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (dialogAgain) {
    await page.getByText('Discard', { exact: true }).click();
    await page.waitForTimeout(800);
  }
  record(
    'Discard leaves add without saving',
    dialogAgain && !page.url().includes('/livestock/add'),
    `url=${page.url()}`,
  );

  await context.setOffline(true);
  await clickAddGoatFromDashboard(page);
  await fillFieldByLabel(page, 'Name', 'Offline tab draft');
  await fillFieldByLabel(page, 'Tag number', 'offline-tab');
  await clickHerdTab(page);
  const offlineDialog = await page
    .getByText('Discard this goat?', { exact: true })
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (offlineDialog) {
    await page.getByText('Keep editing', { exact: true }).click();
    await page.waitForTimeout(400);
  }
  const offlineName = await fieldValueByLabel(page, 'Name');
  record(
    'Herd tab + Keep editing preserves draft (offline)',
    offlineDialog &&
      offlineName === 'Offline tab draft' &&
      page.url().includes('/livestock/add'),
    `dialog=${offlineDialog} name="${offlineName}"`,
  );

  const offlineUrlBeforeBack = page.url();
  await clickHeaderBack(page);
  const offlineBackDialog = await page
    .getByText('Discard this goat?', { exact: true })
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  record(
    'Header back: route unchanged while dialog open (offline)',
    offlineBackDialog && page.url() === offlineUrlBeforeBack,
    `dialog=${offlineBackDialog} url=${page.url()}`,
  );
  if (offlineBackDialog) {
    await clickKeepEditing(page);
  }
  record(
    'Header back + Keep editing preserves draft (offline)',
    offlineBackDialog &&
      (await fieldValueByLabel(page, 'Name')) === 'Offline tab draft' &&
      page.url() === offlineUrlBeforeBack,
    `dialog=${offlineBackDialog}`,
  );

  await openQuickAdd(page);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Breeding/ })
    .click();
  const offlineQuickDiscard = await page
    .getByText('Discard this goat?', { exact: true })
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (offlineQuickDiscard) {
    await page.getByText('Discard', { exact: true }).click();
    await page.waitForTimeout(800);
  }
  record(
    'Quick add + Discard navigates away (offline)',
    offlineQuickDiscard && !page.url().includes('/livestock/add'),
    `url=${page.url()}`,
  );

  await context.setOffline(false);

  const tagB = `AGF-${suffix}-B`;
  const nameB = `AddForm ${suffix} B`;
  await clickHerdTab(page);
  await discardAddGoatDraftIfPrompted(page);
  await clickTodayTab(page);
  await page.waitForTimeout(500);
  await context.setOffline(true);
  await clickAddGoatFromDashboard(page);
  await fillFieldByLabel(page, 'Name', nameB);
  await fillFieldByLabel(page, 'Tag number', tagB);
  await clickSaveGoat(page);
  await page.waitForFunction(
    () => !window.location.pathname.endsWith('/livestock/add'),
    { timeout: 90000 },
  );
  await clickTodayTab(page);
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Add goat' }).first().click();
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
