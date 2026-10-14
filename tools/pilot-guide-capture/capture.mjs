/**
 * Capture /guide screenshots at iPhone viewport width, WebP under 150 KB each.
 * Installed separately from the Expo app — see tools/pilot-guide-capture/package.json.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, '../..');

const require = createRequire(import.meta.url);
const playwrightPath =
  process.env.PLAYWRIGHT_MODULE ?? path.join(toolDir, 'node_modules/playwright');
const { chromium } = require(playwrightPath);
const { createClient } = require('@supabase/supabase-js');
const outDir = path.join(root, 'assets/pilot-guide');
fs.mkdirSync(outDir, { recursive: true });

const baseUrl = (process.env.PILOT_GUIDE_BASE_URL ?? 'http://127.0.0.1:8081').replace(
  /\/$/,
  '',
);
const email =
  process.env.PILOT_GUIDE_EMAIL?.trim() ??
  process.env.DEMO_EMAIL?.trim() ??
  'demo@bloodlinebook.test';
const password =
  process.env.PILOT_GUIDE_PASSWORD?.trim() ?? process.env.DEMO_PASSWORD?.trim();
const farmName = process.env.PILOT_GUIDE_FARM_NAME?.trim() ?? 'Import Test Farm';
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY?.trim() ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

const TEXT_SIZE_ONBOARDING_KEY = 'bloodline.textSizeOnboarding.v1';

function supabaseAuthStorageKey(supabaseUrl) {
  const host = new URL(supabaseUrl).hostname;
  const ref = host.split('.')[0];
  return `sb-${ref}-auth-token`;
}

async function skipTextSizeWelcome(page) {
  await page.addInitScript((key) => {
    window.localStorage.setItem(key, '1');
  }, TEXT_SIZE_ONBOARDING_KEY);
}

async function saveWebp(page, filename) {
  const outPath = path.join(outDir, filename);
  const tmpPng = path.join(os.tmpdir(), `pilot-guide-${filename}.png`);
  await page.screenshot({ type: 'png', fullPage: false, path: tmpPng });

  const trimmed = await sharp(tmpPng)
    .trim({ threshold: 12 })
    .resize({ width: 390, withoutEnlargement: false })
    .png()
    .toBuffer();

  let bestSize = Infinity;
  for (let quality = 88; quality >= 40; quality -= 4) {
    const buffer = await sharp(trimmed).webp({ quality }).toBuffer();
    if (buffer.length < bestSize) {
      bestSize = buffer.length;
      fs.writeFileSync(outPath, buffer);
    }
    if (buffer.length <= 150 * 1024) {
      fs.writeFileSync(outPath, buffer);
      console.log(`Wrote ${filename} (${buffer.length} bytes, q=${quality})`);
      fs.unlinkSync(tmpPng);
      return;
    }
  }
  fs.unlinkSync(tmpPng);
  if (!fs.existsSync(outPath)) {
    throw new Error(`Could not capture ${filename}`);
  }
  console.warn(
    `Wrote ${filename} (${bestSize} bytes) — still above 150 KB; crop or lower quality`,
  );
}

async function signInWithPassword(page) {
  if (!password) {
    throw new Error(
      'Set PILOT_GUIDE_PASSWORD or DEMO_PASSWORD for password sign-in.',
    );
  }
  await page.goto(`${baseUrl}/sign-in`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('input', { timeout: 60000 });
  const inputs = page.locator('input');
  await inputs.nth(0).fill(email);
  await inputs.nth(1).fill(password);
  await page.getByText('Sign In', { exact: true }).last().click();
  await page.getByText('All saved', { exact: true }).waitFor({ timeout: 90000 }).catch(() =>
    page.waitForTimeout(8000),
  );
}

async function signInWithServiceRole(page) {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey || !supabaseAnonKey) {
    return false;
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anon = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    throw error ?? new Error('Could not generate magic link hash');
  }
  const { data: verified, error: verifyError } = await anon.auth.verifyOtp({
    type: 'magiclink',
    token_hash: tokenHash,
  });
  if (verifyError || !verified.session) {
    throw verifyError ?? new Error('Could not verify magic link');
  }
  const storageKey = supabaseAuthStorageKey(supabaseUrl);
  const sessionPayload = {
    ...verified.session,
    expires_at: verified.session.expires_at,
  };
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(
    ({ key, value, onboardingKey }) => {
      window.localStorage.setItem(key, JSON.stringify(value));
      window.localStorage.setItem(onboardingKey, '1');
    },
    {
      key: storageKey,
      value: sessionPayload,
      onboardingKey: TEXT_SIZE_ONBOARDING_KEY,
    },
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForURL((url) => /dashboard|livestock|create-farm/.test(url.toString()), {
    timeout: 120000,
  });
  await page
    .getByText(/Willow Creek Demo|Import Test Farm|Good afternoon/i)
    .first()
    .waitFor({ timeout: 120000 });
  await page.waitForTimeout(3000);
  return true;
}

async function ensureFarmName(page) {
  const dashboardText = await page.locator('body').innerText();
  if (farmName && !dashboardText.includes(farmName)) {
    console.warn(
      `Dashboard does not mention "${farmName}". Screenshots will use the active farm.`,
    );
  }
}

async function captureCreateFarmScreenshot(admin, page) {
  const tempPassword = `PilotGuide-${Date.now()}-Aa1`;
  const tempEmail = `pilot-guide-${Date.now()}@bloodlinebook.test`;
  const { error: createError } = await admin.auth.admin.createUser({
    email: tempEmail,
    password: tempPassword,
    email_confirm: true,
  });
  if (createError) {
    throw createError;
  }
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const anon = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: signedIn, error: signInError } = await anon.auth.signInWithPassword({
    email: tempEmail,
    password: tempPassword,
  });
  if (signInError || !signedIn.session) {
    throw signInError ?? new Error('Could not sign in temp pilot user');
  }
  const storageKey = supabaseAuthStorageKey(supabaseUrl);
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(
    ({ key, value }) => {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    { key: storageKey, value: signedIn.session },
  );
  await page.goto(`${baseUrl}/create-farm`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await page.waitForTimeout(2500);
  await saveWebp(page, 'create-farm.webp');
  await anon.auth.signOut();
}

async function captureSignedOut(page, admin) {
  await page.goto(`${baseUrl}/sign-up`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await page.waitForTimeout(1500);
  await saveWebp(page, 'sign-up.webp');

  if (admin) {
    await captureCreateFarmScreenshot(admin, page);
  }
}

async function captureSignedIn(page) {
  await page.goto(`${baseUrl}/livestock/add`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await page.waitForTimeout(2500);
  await saveWebp(page, 'add-goat.webp');

  await page.goto(`${baseUrl}/livestock`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await page.waitForTimeout(2500);
  await saveWebp(page, 'herd-list.webp');

  await page.goto(`${baseUrl}/livestock`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await page.waitForTimeout(4000);
  const herdLink = page.getByText(/Daisy|Clover/i).first();
  await herdLink.waitFor({ timeout: 60000 });
  await herdLink.click();
  await page.waitForTimeout(2500);
  const familyTree = page.getByText('Family tree', { exact: true });
  if (await familyTree.isVisible().catch(() => false)) {
    await familyTree.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
  }
  await saveWebp(page, 'family-tree.webp');

  await page.goto(`${baseUrl}/livestock/weight`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await page.waitForTimeout(2500);
  await saveWebp(page, 'record-weight.webp');
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const admin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

try {
  await skipTextSizeWelcome(page);
  await captureSignedOut(page, admin);
  await page.close();

  const signedInPage = await context.newPage();
  await skipTextSizeWelcome(signedInPage);

  const magic = await signInWithServiceRole(signedInPage);
  if (!magic) {
    await signInWithPassword(signedInPage);
  }
  await ensureFarmName(signedInPage);
  await captureSignedIn(signedInPage);
  console.log('Pilot guide screenshots captured.');
} finally {
  await browser.close();
}
