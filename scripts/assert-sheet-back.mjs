import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { attachSheetBack } from '../lib/navigation/sheet-back.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir, found = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.expo' || name === 'dist') {
      continue;
    }
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walk(path, found);
      continue;
    }
    if (name.endsWith('.tsx')) {
      found.push(path);
    }
  }
  return found;
}

const modalFiles = walk(root).filter((path) =>
  readFileSync(path, 'utf8').includes('<Modal'),
);
assert.ok(modalFiles.length >= 8, `expected the app modals, found ${modalFiles.length}`);
for (const path of modalFiles) {
  const source = readFileSync(path, 'utf8');
  assert.match(
    source,
    /useCloseOnBack\(/,
    `${relative(root, path)} renders a Modal without useCloseOnBack`,
  );
}
assert.match(
  readFileSync(join(root, 'app/(tabs)/livestock/weight.tsx'), 'utf8'),
  /useCloseOnBack\(true, onClose\)/,
);

function createSentinelHost(initial) {
  const entries = initial.map((entry) => ({ ...entry }));
  let index = entries.length - 1;
  const listeners = [];
  let bubblePops = 0;
  const target = {
    location: { href: entries[index].url },
    history: {
      get state() {
        return entries[index].state;
      },
      pushState(state, _title, url) {
        entries.splice(index + 1);
        entries.push({ state, url: url ?? target.location.href });
        index = entries.length - 1;
        target.location.href = entries[index].url;
      },
      back() {
        if (index === 0) {
          throw new Error('nowhere to go');
        }
        index -= 1;
        target.location.href = entries[index].url;
        const event = {
          stopped: false,
          stopImmediatePropagation() {
            this.stopped = true;
          },
        };
        const capture = listeners.filter((listener) => listener.capture);
        const bubble = listeners.filter((listener) => !listener.capture);
        for (const group of [capture, bubble]) {
          for (const listener of [...group]) {
            listener.fn(event);
            if (event.stopped) {
              return;
            }
          }
        }
      },
    },
    addEventListener(type, fn, capture) {
      assert.equal(type, 'popstate');
      listeners.push({ fn, capture: capture === true });
    },
    removeEventListener(type, fn, capture) {
      assert.equal(type, 'popstate');
      const at = listeners.findIndex(
        (listener) => listener.fn === fn && listener.capture === (capture === true),
      );
      if (at !== -1) {
        listeners.splice(at, 1);
      }
    },
  };
  target.addEventListener('popstate', () => {
    bubblePops += 1;
  }, false);
  return {
    target,
    get index() {
      return index;
    },
    get href() {
      return target.location.href;
    },
    get bubblePops() {
      return bubblePops;
    },
    get length() {
      return entries.length;
    },
  };
}

// Back pops only the sheet entry and stays on this screen. The router's
// popstate listener (bubble) does not run.
{
  const host = createSentinelHost([
    { state: { id: 'today' }, url: 'https://app.example/today' },
    { state: { id: 'more' }, url: 'https://app.example/more' },
  ]);
  const closed = [];
  let detachFarm;
  let detachTag;
  detachFarm = attachSheetBack(() => {
    closed.push('farm');
    detachFarm();
  }, host.target);
  detachTag = attachSheetBack(() => {
    closed.push('tag');
    detachTag();
  }, host.target);
  assert.equal(host.length, 4);
  host.target.history.back();
  assert.deepEqual(closed, ['tag']);
  assert.equal(host.href, 'https://app.example/more');
  assert.equal(host.bubblePops, 0);
  host.target.history.back();
  assert.deepEqual(closed, ['tag', 'farm']);
  assert.equal(host.href, 'https://app.example/more');
  assert.equal(host.bubblePops, 0);
  assert.equal(host.target.history.state.id, 'more');
  host.target.history.back();
  assert.equal(host.href, 'https://app.example/today');
  assert.equal(host.bubblePops, 1);
}

// The Close button drops the sheet entry without telling the router to go back.
{
  const host = createSentinelHost([
    { state: { id: 'today' }, url: 'https://app.example/today' },
    { state: { id: 'more' }, url: 'https://app.example/more' },
  ]);
  const detach = attachSheetBack(() => {
    throw new Error('button close should not call onClose');
  }, host.target);
  detach();
  assert.equal(host.href, 'https://app.example/more');
  assert.equal(host.target.history.state.id, 'more');
  assert.equal(host.bubblePops, 0);
  host.target.history.back();
  assert.equal(host.href, 'https://app.example/today');
  assert.equal(host.bubblePops, 1);
}

// A sheet closed underneath a later history entry is skipped on the next Back.
{
  const host = createSentinelHost([
    { state: { id: 'more' }, url: 'https://app.example/more' },
  ]);
  const detach = attachSheetBack(() => {
    throw new Error('buried sheet should already be closed');
  }, host.target);
  host.target.history.pushState({ id: 'kidding' }, '', 'https://app.example/kidding');
  detach();
  assert.equal(host.href, 'https://app.example/kidding');
  host.target.history.back();
  assert.equal(host.href, 'https://app.example/more');
  assert.equal(host.target.history.state.id, 'more');
  assert.equal(host.bubblePops, 1);
  assert.equal(host.index, 0);
}

console.log('assert-sheet-back: ok');
