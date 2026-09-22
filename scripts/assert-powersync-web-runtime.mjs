import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = require('node:fs').readFileSync(
  join(root, 'lib/powersync/web-runtime.ts'),
  'utf8',
);

const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;

const module = { exports: {} };
const fn = new Function('exports', 'module', transpiled);
fn(module.exports, module);

const {
  POWER_SYNC_WEB_WORKER_PATH,
  getPowerSyncWorkerUrl,
  isEmbeddedBrowserUserAgent,
  isPowerSyncWebWorkerSafe,
  resolvePowerSyncWebFlags,
} = module.exports;

function snapshot(overrides) {
  return {
    hasWindow: true,
    isIframe: false,
    isEmbeddedBrowser: false,
    hostname: 'localhost',
    hasSharedWorker: true,
    hasDedicatedWorker: true,
    hasWebLocks: true,
    isSecureContext: true,
    ...overrides,
  };
}

assert.equal(POWER_SYNC_WEB_WORKER_PATH, '/powersync/worker.js');
assert.equal(
  getPowerSyncWorkerUrl('https://8081-preview.example.com'),
  'https://8081-preview.example.com/powersync/worker.js',
);
assert.doesNotMatch(getPowerSyncWorkerUrl('https://app.example'), /\/@/);

assert.equal(isEmbeddedBrowserUserAgent('Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36'), false);
assert.equal(
  isEmbeddedBrowserUserAgent(
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Cursor/2.0.0 Chrome/128.0.6613.186 Electron/32.2.6 Safari/537.36',
  ),
  true,
);

const vmBrowser = resolvePowerSyncWebFlags(snapshot({ hostname: 'localhost' }));
assert.deepEqual(vmBrowser, { enableMultiTabs: true, useWebWorker: true });
assert.equal(isPowerSyncWebWorkerSafe(snapshot({ hostname: 'localhost' })), true);

const vercelLike = resolvePowerSyncWebFlags(
  snapshot({ hostname: 'bloodline-book.vercel.app' }),
);
assert.deepEqual(vercelLike, { enableMultiTabs: true, useWebWorker: true });

const agentEmbedded = resolvePowerSyncWebFlags(
  snapshot({
    hostname: 'localhost',
    isEmbeddedBrowser: true,
  }),
);
assert.deepEqual(agentEmbedded, {
  enableMultiTabs: false,
  useWebWorker: false,
});

const agentIframe = resolvePowerSyncWebFlags(
  snapshot({
    hostname: 'localhost',
    isIframe: true,
  }),
);
assert.deepEqual(agentIframe, {
  enableMultiTabs: false,
  useWebWorker: false,
});

const insecure = resolvePowerSyncWebFlags(
  snapshot({
    hasWebLocks: false,
    isSecureContext: false,
  }),
);
assert.deepEqual(insecure, {
  enableMultiTabs: false,
  useWebWorker: false,
});

const copy = spawnSync('bash', [join(root, 'scripts/copy-powersync-web-assets.sh')], {
  cwd: root,
  encoding: 'utf8',
});
assert.equal(copy.status, 0, copy.stderr || copy.stdout);

const fs = require('node:fs');
assert.equal(fs.existsSync(join(root, 'public/powersync/worker.js')), true);

console.log('assert-powersync-web-runtime: ok');
