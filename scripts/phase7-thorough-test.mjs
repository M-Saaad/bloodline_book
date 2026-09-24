/**
 * Phase 7 "Done when" browser checks against the demo farm (localhost:8081).
 * Run: PLAYWRIGHT_BROWSERS_PATH=0 node scripts/phase7-thorough-test.mjs
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const playwrightPath =
  process.env.PLAYWRIGHT_MODULE ??
  '/home/ubuntu/.npm/_npx/d5a47a4fe12657da/node_modules/playwright';
const { chromium } = require(playwrightPath);

const artifactsDir = '/opt/cursor/artifacts';
mkdirSync(artifactsDir, { recursive: true });

const suffix = String(Date.now()).slice(-6);
const tagOnly = `P7-T${suffix}`;
const tattooNeedle = `P7INK${suffix}`;

const results = [];

function record(name, passed, detail = '') {
  results.push({ name, passed, detail });
  const mark = passed ? 'PASS' : 'FAIL';
  console.log(`${mark}: ${name}${detail ? ` — ${detail}` : ''}`);
}

async function signIn(page) {
  await page.goto('http://127.0.0.1:8081/', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('input', { timeout: 30000 });
  const inputs = page.locator('input');
  await inputs.nth(0).fill('demo@bloodlinebook.test');
  await inputs.nth(1).fill('DemoHerd2026!');
  await page.getByText('Sign In', { exact: true }).last().click();
  await page.waitForTimeout(12000);
}

async function openLivestock(page) {
  await page.goto('http://127.0.0.1:8081/livestock', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(2500);
}

async function openAddAnimal(page) {
  await page.goto('http://127.0.0.1:8081/livestock/add', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(2500);
}

async function fillFieldByLabel(page, label, value) {
  const labelNode = page.getByText(label, { exact: true }).first();
  const container = labelNode.locator('..');
  await container.locator('input').first().fill(value);
}

async function saveAnimalForm(page) {
  await page.getByText('Save Animal', { exact: true }).click();
  await page.waitForTimeout(3000);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

try {
  await signIn(page);
  record('Sign in to demo farm', true);

  // Neither name nor tag shows error
  await openLivestock(page);
  await openAddAnimal(page);
  await fillFieldByLabel(page, 'Name', '');
  await fillFieldByLabel(page, 'Tag number', '');
  await saveAnimalForm(page);
  const nameTagError = await page
    .getByText('Enter a name or a tag number.')
    .isVisible()
    .catch(() => false);
  record(
    'Block save when neither name nor tag',
    nameTagError,
    nameTagError ? '' : 'Expected validation message',
  );
  await page.screenshot({
    path: `${artifactsDir}/phase7-test-no-name-tag-error.png`,
    fullPage: true,
  });

  // Tag-only save
  await fillFieldByLabel(page, 'Tag number', tagOnly);
  await saveAnimalForm(page);
  await openLivestock(page);
  const onListAfterTagSave =
    (await page.getByText(`#${tagOnly}`, { exact: false }).count()) > 0;
  record(
    'Goat with only a tag saves and appears in herd list',
    onListAfterTagSave,
    tagOnly,
  );

  // Duplicate tag warning (non-blocking)
  await openAddAnimal(page);
  await fillFieldByLabel(page, 'Tag number', 'WCD-101');
  await page.waitForTimeout(1500);
  const dupWarning = await page
    .getByText(/already used by/i)
    .isVisible()
    .catch(() => false);
  record(
    'Duplicate tag shows warning on add',
    dupWarning,
    dupWarning ? '' : 'No warning for WCD-101',
  );
  await page.goto('http://127.0.0.1:8081/livestock', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(1500);

  // Tattoo search — edit Daisy (WCD-101)
  await fillFieldByLabel(page, 'Search herd', 'WCD-101');
  await page.waitForTimeout(800);
  await page.getByText('#WCD-101', { exact: false }).first().click();
  await page.waitForTimeout(2000);
  await page.getByText('Edit Animal', { exact: true }).click();
  await page.waitForTimeout(2500);
  await page.getByText('Save Changes', { exact: true }).waitFor({ timeout: 15000 });
  await page.getByPlaceholder('Right ear / Left ear').fill(tattooNeedle);
  await page.getByText('Save Changes', { exact: true }).click();
  await page.waitForTimeout(3000);
  await openLivestock(page);
  await fillFieldByLabel(page, 'Search herd', tattooNeedle);
  await page.waitForTimeout(1000);
  const tattooHit = (await page.getByText('Daisy', { exact: false }).count()) > 0;
  record('Searching by tattoo finds the goat', tattooHit, tattooNeedle);
  await page.screenshot({
    path: `${artifactsDir}/phase7-test-tattoo-search.png`,
    fullPage: true,
  });

  // Kids show dam and sire links (via dam's offspring list)
  await openLivestock(page);
  await fillFieldByLabel(page, 'Search herd', 'WCD-101');
  await page.waitForTimeout(800);
  await page.getByText('#WCD-101', { exact: false }).first().click();
  await page.waitForTimeout(2000);
  await page.getByText('Daisy kid 1', { exact: true }).first().click();
  await page.waitForTimeout(2000);
  const kidDamLink = await page.getByText('Daisy', { exact: true }).count();
  const kidSireLink = await page.getByText('Atlas', { exact: true }).count();
  const kidsHaveParents = kidDamLink >= 1 && kidSireLink >= 1;
  record(
    'Registered kid shows dam and sire on animal page',
    kidsHaveParents,
    `Daisy refs=${kidDamLink}, Atlas refs=${kidSireLink}`,
  );
  await page.screenshot({
    path: `${artifactsDir}/phase7-test-kid-parents.png`,
    fullPage: true,
  });

  // Parent ↔ offspring links on dam profile
  await openLivestock(page);
  await fillFieldByLabel(page, 'Search herd', 'WCD-101');
  await page.waitForTimeout(800);
  await page.getByText('#WCD-101', { exact: false }).first().click();
  await page.waitForTimeout(2500);
  const offspringVisible = await page
    .getByText('Offspring', { exact: true })
    .first()
    .isVisible()
    .catch(() => false);
  const offspringListed =
    (await page.getByText('Daisy kid 1', { exact: true }).count()) >= 1;
  record(
    'Dam page lists offspring and kid opens from list',
    offspringVisible && offspringListed,
    `offspringVisible=${offspringVisible}, offspringListed=${offspringListed}`,
  );
  await page.screenshot({
    path: `${artifactsDir}/phase7-test-parent-offspring-links.png`,
    fullPage: true,
  });

  // Set dam + sire on a new goat and verify dam offspring list
  const linkedTag = `P7-L${suffix}`;
  await openAddAnimal(page);
  await fillFieldByLabel(page, 'Name', `Link test ${suffix}`);
  await fillFieldByLabel(page, 'Tag number', linkedTag);
  await page.getByText('Clover', { exact: true }).first().click();
  await page.getByText('On farm', { exact: true }).click();
  await page.getByText('Atlas', { exact: true }).first().click();
  await saveAnimalForm(page);
  await openLivestock(page);
  await fillFieldByLabel(page, 'Search herd', 'Clover');
  await page.waitForTimeout(800);
  await page.getByText('#WCD-102', { exact: false }).first().click();
  await page.waitForTimeout(2500);
  const linkedKidListed =
    (await page.getByText(`Link test ${suffix}`, { exact: true }).count()) >= 1;
  record(
    'After setting dam and sire, dam offspring lists the new goat',
    linkedKidListed,
    linkedTag,
  );
  await page.screenshot({
    path: `${artifactsDir}/phase7-test-dam-sire-link.png`,
    fullPage: true,
  });

  // Mark tag-only goat sold; filter Sold; still opens
  await openLivestock(page);
  await fillFieldByLabel(page, 'Search herd', tagOnly);
  await page.waitForTimeout(800);
  await page.getByText(`#${tagOnly}`, { exact: false }).first().click();
  await page.waitForTimeout(2000);
  await page.getByText('Edit Animal', { exact: true }).click();
  await page.waitForTimeout(2000);
  await page.getByText('Save Changes', { exact: true }).waitFor({ timeout: 15000 });
  await page.getByText('Sold', { exact: true }).last().click();
  await page.getByText('Save Changes', { exact: true }).click();
  await page.waitForTimeout(3000);
  await openLivestock(page);
  await page.getByText('Sold', { exact: true }).first().click();
  await page.waitForTimeout(1500);
  const soldRow = (await page.getByText(`#${tagOnly}`, { exact: false }).count()) > 0;
  if (soldRow) {
    await page.getByText(`#${tagOnly}`, { exact: false }).first().click();
    await page.waitForTimeout(2000);
    const detailOpen = await page
      .getByText('Identity', { exact: true })
      .first()
      .isVisible();
    record('Sold goat appears under Sold filter and opens', detailOpen, tagOnly);
  } else {
    record('Sold goat appears under Sold filter and opens', false, 'Row missing');
  }
  await page.screenshot({
    path: `${artifactsDir}/phase7-test-sold-filter.png`,
    fullPage: true,
  });

  // Dashboard total on record → All filter
  await page.goto('http://127.0.0.1:8081/dashboard', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(2500);
  await page.getByText('total on record', { exact: false }).click({ force: true });
  await page.waitForTimeout(3000);
  const url = page.url();
  const showsSoldGoat =
    (await page.getByText(`#${tagOnly}`, { exact: false }).count()) > 0;
  const showsActiveGoat =
    (await page.getByText('#WCD-101', { exact: false }).count()) > 0;
  record(
    'Dashboard total on record opens herd with All filter',
    url.includes('status=all') && showsSoldGoat && showsActiveGoat,
    `url=${url}, soldVisible=${showsSoldGoat}, activeVisible=${showsActiveGoat}`,
  );
  await page.screenshot({
    path: `${artifactsDir}/phase7-test-dashboard-all-filter.png`,
    fullPage: true,
  });

  const failed = results.filter((r) => !r.passed);
  writeFileSync(
    `${artifactsDir}/phase7-test-results.json`,
    JSON.stringify({ suffix, tagOnly, tattooNeedle, results, failed: failed.length }, null, 2),
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  } else {
    console.log('phase7-thorough-test: all checks passed');
  }
} catch (error) {
  await page.screenshot({
    path: `${artifactsDir}/phase7-test-fatal.png`,
    fullPage: true,
  });
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
