/**
 * Browser Back is a history traversal. React Native Web calls Modal
 * `onRequestClose` for the Escape key only, so a sheet stays open.
 *
 * Chrome's Navigation API reports that traversal as not cancelable, so
 * `preventDefault` does not stop the system Back button. Opening a sheet
 * pushes one same-URL history entry. Back pops that entry and leaves the
 * screen URL alone; the pop is swallowed so the tab router does not run.
 *
 * The tag sheet and the farm picker both use Modal. The tag sheet sits on
 * the goat screen, so Back used to pop that screen and unmount the sheet
 * with it. The farm picker sits on the More tab, which stays mounted, so
 * the sheet stayed up over the previous tab.
 */

export type PopStateEventLike = {
  stopImmediatePropagation: () => void;
};

export type SheetBackHost = {
  history: {
    readonly state: unknown;
    pushState: (data: unknown, unused: string, url?: string | null) => void;
    back: () => void;
  };
  location: { href: string };
  addEventListener: (
    type: 'popstate',
    listener: (event: PopStateEventLike) => void,
    capture?: boolean,
  ) => void;
  removeEventListener: (
    type: 'popstate',
    listener: (event: PopStateEventLike) => void,
    capture?: boolean,
  ) => void;
};

const SHEET_MARKER = '__bloodlineSheet';

type SentinelEntry = {
  marker: string;
  onClose: () => void;
  removedByPop: boolean;
};

const sentinelStacks = new WeakMap<object, SentinelEntry[]>();
const sentinelDismissed = new WeakMap<object, Set<string>>();
const sentinelListening = new WeakSet<object>();

let markerSeq = 0;

export function attachSheetBack(onClose: () => void, target: SheetBackHost): () => void {
  ensureSentinelListener(target);
  const marker = `sheet-${++markerSeq}`;
  const previous = target.history.state;
  const base =
    previous !== null && typeof previous === 'object'
      ? { ...(previous as Record<string, unknown>) }
      : {};
  target.history.pushState({ ...base, [SHEET_MARKER]: marker }, '', target.location.href);
  const stack = sentinelStack(target);
  const entry: SentinelEntry = { marker, onClose, removedByPop: false };
  stack.push(entry);
  return () => {
    const current = sentinelStack(target);
    const index = current.lastIndexOf(entry);
    if (index !== -1) {
      current.splice(index, 1);
    }
    if (entry.removedByPop) {
      return;
    }
    if (readMarker(target.history.state) !== marker) {
      dismissedSet(target).add(marker);
      return;
    }
    const swallow = (event: PopStateEventLike) => {
      event.stopImmediatePropagation();
      target.removeEventListener('popstate', swallow, true);
    };
    target.addEventListener('popstate', swallow, true);
    target.history.back();
  };
}

function ensureSentinelListener(target: SheetBackHost) {
  if (sentinelListening.has(target)) {
    return;
  }
  sentinelListening.add(target);
  target.addEventListener(
    'popstate',
    (event) => {
      const marker = readMarker(target.history.state);
      const skipped = sentinelDismissed.get(target);
      if (marker && skipped?.has(marker)) {
        event.stopImmediatePropagation();
        skipped.delete(marker);
        target.history.back();
        return;
      }
      const stack = sentinelStacks.get(target);
      const top = stack?.[stack.length - 1];
      if (!stack || !top || marker === top.marker) {
        return;
      }
      top.removedByPop = true;
      stack.pop();
      event.stopImmediatePropagation();
      top.onClose();
    },
    true,
  );
}

function sentinelStack(target: object): SentinelEntry[] {
  let stack = sentinelStacks.get(target);
  if (!stack) {
    stack = [];
    sentinelStacks.set(target, stack);
  }
  return stack;
}

function dismissedSet(target: object): Set<string> {
  let set = sentinelDismissed.get(target);
  if (!set) {
    set = new Set();
    sentinelDismissed.set(target, set);
  }
  return set;
}

function readMarker(state: unknown): string | null {
  if (!state || typeof state !== 'object') {
    return null;
  }
  const value = (state as Record<string, unknown>)[SHEET_MARKER];
  return typeof value === 'string' ? value : null;
}
