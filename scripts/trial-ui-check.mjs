/**
 * Browser checks for the trial-release fixes against the demo farm.
 * Run: PLAYWRIGHT_BROWSERS_PATH=0 node scripts/trial-ui-check.mjs
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const playwrightPath =
  process.env.PLAYWRIGHT_MODULE ??
  '/home/ubuntu/.npm/_npx/d5a47a4fe12657da/node_modules/playwright';
const { chromium } = require(playwrightPath);

const artifactsDir = '/opt/cursor/artifacts';
mkdirSync(artifactsDir, { recursive: true });

const suffix = String(Date.now()).slice(-6);
const probeTask = `Trial probe ${suffix}`;
const offlineTask = `Offline probe ${suffix}`;
const healthNote = `trial-ui-${suffix}`;

const results = [];

function record(name, passed, detail = '') {
  results.push({ name, passed, detail });
  console.log(`${passed ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
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
  await page.getByText('All saved', { exact: true }).waitFor({ timeout: 30000 });
}

async function gotoApp(page, path) {
  await page.goto(`http://127.0.0.1:8081${path}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForTimeout(1500);
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
});
const page = await context.newPage();
page.on('console', (msg) => {
  if (msg.type() === 'error') {
    console.log('BROWSER', msg.text().slice(0, 300));
  }
});

try {
  await signIn(page);
  record('Sign in', true);

  const visibleGlyphs = await page.locator('[role="tablist"]').evaluate((bar) => {
    function painted(emoji) {
      return [...bar.querySelectorAll('div')].filter((node) => {
        if (node.childElementCount !== 0 || node.textContent !== emoji) {
          return false;
        }
        let el = node;
        while (el && el !== bar.parentElement) {
          if (Number(getComputedStyle(el).opacity) === 0) {
            return false;
          }
          el = el.parentElement;
        }
        return true;
      }).length;
    }
    return {
      home: painted('🏠'),
      goats: painted('🐐'),
      land: painted('🌾'),
      money: painted('💰'),
      more: painted('⋯'),
      barHeight: bar.getBoundingClientRect().height,
    };
  });
  const iconsOnce =
    visibleGlyphs.home === 1 &&
    visibleGlyphs.goats === 1 &&
    visibleGlyphs.land === 1 &&
    visibleGlyphs.money === 1 &&
    visibleGlyphs.more === 1 &&
    visibleGlyphs.barHeight < 80;
  record(
    'Each tab shows one icon',
    iconsOnce,
    JSON.stringify(visibleGlyphs),
  );
  await page.screenshot({
    path: `${artifactsDir}/trial-tab-icons.png`,
    fullPage: false,
  });

  await gotoApp(page, '/more/health/add');
  const search = page.getByPlaceholder('Search by name or tag').first();
  await search.waitFor({ timeout: 15000 });
  await search.fill('WCD-101');
  await page.waitForTimeout(500);
  const daisyRow = page.getByText('#WCD-101 · Daisy', { exact: false }).first();
  const daisyVisible = await daisyRow.isVisible().catch(() => false);
  const tagLine = await page.getByText(/Tag WCD-101/, { exact: false }).first().isVisible().catch(() => false);
  const cloverHidden = (await page.getByText('#WCD-102', { exact: false }).count()) === 0;
  record(
    'Health picker search shows tag and filters',
    daisyVisible && tagLine && cloverHidden,
    `daisy=${daisyVisible} tagLine=${tagLine} otherHidden=${cloverHidden}`,
  );
  await page.screenshot({
    path: `${artifactsDir}/trial-goat-search.png`,
    fullPage: true,
  });

  await gotoApp(page, '/more/breeding/add-breeding');
  const breedingSearch = page.getByPlaceholder('Search by name or tag').first();
  const breedingSearchVisible = await breedingSearch.isVisible().catch(() => false);
  record('Breeding form has goat search', breedingSearchVisible);

  await gotoApp(page, '/more/breeding/add-kidding');
  const kiddingSearch = page.getByPlaceholder('Search by name or tag').first();
  await kiddingSearch.waitFor({ timeout: 15000 });
  await kiddingSearch.fill('Daisy');
  await page.waitForTimeout(400);
  await page.getByText('#WCD-101 · Daisy', { exact: false }).first().click();
  await page.waitForTimeout(400);
  const kidPlaceholder = await page
    .getByPlaceholder(/Daisy 26 kid 1/)
    .first()
    .getAttribute('placeholder')
    .catch(() => '');
  record(
    'Kid name placeholder includes the year',
    kidPlaceholder.includes('26 kid 1'),
    kidPlaceholder,
  );
  await page.screenshot({
    path: `${artifactsDir}/trial-kid-name.png`,
    fullPage: false,
  });

  await gotoApp(page, '/livestock');
  await page.getByPlaceholder('Name, tag, official ID, registration, tattoo').fill('WCD-101');
  await page.waitForTimeout(600);
  await page.getByText('#WCD-101', { exact: false }).first().click();
  await page.waitForTimeout(1200);
  await page.getByText('Edit Animal', { exact: true }).click();
  await page.waitForURL(/\/livestock\/edit\//, { timeout: 15000 });
  const statusLabel = page.getByText('Status', { exact: true }).nth(1);
  await statusLabel.scrollIntoViewIfNeeded();
  await statusLabel.waitFor({ state: 'visible', timeout: 15000 });
  const deceased = await page.getByText('Deceased', { exact: true }).count();
  const deadLabel = await page.getByText('Dead', { exact: true }).count();
  record('Edit goat uses Dead', deceased === 0 && deadLabel > 0, `dead=${deadLabel}`);

  await gotoApp(page, '/more/health/add');
  await page.getByPlaceholder('Search by name or tag').first().fill('WCD-101');
  await page.waitForTimeout(400);
  await page.getByText('#WCD-101 · Daisy', { exact: false }).first().click();
  await page.getByText('FAMACHA', { exact: true }).click();
  await page.getByText('4', { exact: true }).click();
  const notes = page.getByPlaceholder('Optional').last();
  await notes.fill(healthNote);
  await page.getByText('Save Health Record', { exact: true }).click();
  await page.getByText('Deworm now', { exact: true }).waitFor({ timeout: 20000 });
  const notNow = await page.getByText('Not now', { exact: true }).isVisible();
  const okCancel =
    (await page.getByText('OK', { exact: true }).count()) +
    (await page.getByText('Cancel', { exact: true }).count());
  record(
    'FAMACHA follow-up uses Deworm now / Not now',
    notNow && okCancel === 0,
    `notNow=${notNow} okCancel=${okCancel}`,
  );
  await page.screenshot({
    path: `${artifactsDir}/trial-deworm-dialog.png`,
    fullPage: false,
  });
  await page.getByText('Not now', { exact: true }).click();
  await page.waitForTimeout(2000);

  await gotoApp(page, '/dashboard');
  const dewormOnToday = page.getByText('Deworm — Daisy (FAMACHA 4)', { exact: false }).first();
  let dewormVisible = false;
  try {
    await dewormOnToday.waitFor({ state: 'visible', timeout: 10000 });
    dewormVisible = true;
    await page.screenshot({
      path: `${artifactsDir}/trial-deworm-task.png`,
      fullPage: false,
    });
  } catch {
    dewormVisible = false;
  }
  record('Deworm task uses the goat name', dewormVisible);

  await gotoApp(page, '/more/health');
  await page.getByText(healthNote, { exact: true }).first().click();
  await page.waitForTimeout(1200);
  await page.getByText('Delete', { exact: true }).last().click();
  await page.getByText('Delete health record?', { exact: true }).waitFor({ timeout: 10000 });
  const deleteLabel = await page.getByText('Delete', { exact: true }).last().isVisible();
  record('Delete dialog names the action', deleteLabel);
  await page.screenshot({
    path: `${artifactsDir}/trial-delete-dialog.png`,
    fullPage: false,
  });
  await page.getByText('Delete', { exact: true }).last().click();
  await page.waitForTimeout(2000);

  await gotoApp(page, '/more/tasks/add');
  await page.getByPlaceholder('Check water troughs').fill(probeTask);
  await page.getByText('Save Task', { exact: true }).click();
  await page.waitForTimeout(2000);
  await gotoApp(page, '/dashboard');
  const noDate = await page.getByText('No date', { exact: true }).first().isVisible().catch(() => false);
  const probeOnToday = await page.getByText(probeTask, { exact: false }).first().isVisible().catch(() => false);
  record(
    'Undated task appears under No date',
    noDate && probeOnToday,
    `noDate=${noDate} probe=${probeOnToday}`,
  );
  await page.screenshot({
    path: `${artifactsDir}/trial-no-date.png`,
    fullPage: true,
  });

  await gotoApp(page, '/more/tasks');
  await page.getByText(probeTask, { exact: false }).first().click();
  await page.waitForTimeout(800);
  await page.getByText('Delete', { exact: true }).last().click();
  await page.getByText('Delete', { exact: true }).last().click();
  await page.waitForTimeout(1500);

  await gotoApp(page, '/more/tasks/add');
  await page.getByText('All saved', { exact: true }).waitFor({ timeout: 20000 });
  await context.setOffline(true);
  await page.waitForTimeout(800);
  await page.getByPlaceholder('Check water troughs').fill(offlineTask);
  await page.getByText('Save Task', { exact: true }).click();
  const offlineBadge = page.getByText(/Offline · \d+ waiting/);
  await offlineBadge.first().waitFor({ timeout: 15000 });
  const offlineLabel = await offlineBadge.first().innerText();
  record('Offline badge shows waiting count', /Offline · \d+ waiting/.test(offlineLabel), offlineLabel);
  await page.screenshot({
    path: `${artifactsDir}/trial-offline-badge.png`,
    fullPage: false,
  });

  await context.setOffline(false);
  await page.getByText('All saved', { exact: true }).first().waitFor({ timeout: 40000 });
  record('Reconnect reaches All saved', true);
  await page.screenshot({
    path: `${artifactsDir}/trial-all-saved.png`,
    fullPage: false,
  });

  await gotoApp(page, '/more/changes-not-saved');
  const emptyFailures = await page
    .getByText('Nothing here — all changes are saved.', { exact: true })
    .isVisible()
    .catch(() => false);
  record('Changes not saved is empty', emptyFailures);
  await page.screenshot({
    path: `${artifactsDir}/trial-changes-empty.png`,
    fullPage: false,
  });

  await gotoApp(page, '/more/tasks');
  const probes = page.getByText(/Offline probe|Trial probe/, { exact: false });
  let removed = 0;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if ((await probes.count()) === 0) {
      break;
    }
    await probes.first().click();
    await page.waitForTimeout(800);
    await page.getByText('Delete', { exact: true }).last().click();
    await page.getByText('Delete', { exact: true }).last().click();
    await page.waitForTimeout(1500);
    removed += 1;
    await gotoApp(page, '/more/tasks');
  }
  await page.getByText('All saved', { exact: true }).first().waitFor({ timeout: 30000 });
  record('Probe tasks removed', removed > 0, `removed=${removed}`);
} catch (error) {
  record('Script', false, error instanceof Error ? error.message : String(error));
  await page.screenshot({
    path: `${artifactsDir}/trial-ui-failure.png`,
    fullPage: true,
  }).catch(() => {});
} finally {
  await context.setOffline(false).catch(() => {});
  await browser.close();
}

const failed = results.filter((item) => !item.passed);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  process.exitCode = 1;
}
