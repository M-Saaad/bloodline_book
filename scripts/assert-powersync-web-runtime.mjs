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
  resolvePowerSyncWebFlags,
} = module.exports;

assert.equal(POWER_SYNC_WEB_WORKER_PATH, '/powersync/worker.js');
assert.equal(
  getPowerSyncWorkerUrl('https://8081-preview.example.com'),
  'https://8081-preview.example.com/powersync/worker.js',
);
assert.equal(getPowerSyncWorkerUrl(), '/powersync/worker.js');
assert.doesNotMatch(getPowerSyncWorkerUrl('https://app.example'), /\/@/);

const vercelLike = resolvePowerSyncWebFlags({
  hasWindow: true,
  isIframe: false,
  hasSharedWorker: true,
  hasDedicatedWorker: true,
  hasWebLocks: true,
  isSecureContext: true,
});
assert.deepEqual(vercelLike, {
  enableMultiTabs: true,
  useWebWorker: true,
});

const agentIframe = resolvePowerSyncWebFlags({
  hasWindow: true,
  isIframe: true,
  hasSharedWorker: true,
  hasDedicatedWorker: true,
  hasWebLocks: true,
  isSecureContext: true,
});
assert.deepEqual(agentIframe, {
  enableMultiTabs: false,
  useWebWorker: true,
});

const insecure = resolvePowerSyncWebFlags({
  hasWindow: true,
  isIframe: false,
  hasSharedWorker: true,
  hasDedicatedWorker: true,
  hasWebLocks: false,
  isSecureContext: false,
});
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
