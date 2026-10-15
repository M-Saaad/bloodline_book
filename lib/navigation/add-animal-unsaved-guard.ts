type AddAnimalUnsavedHandlers = {
  isDirty: () => boolean;
  confirmDiscard: () => Promise<boolean>;
};

let handlers: AddAnimalUnsavedHandlers | null = null;
let confirmInFlight: Promise<boolean> | null = null;

export const ADD_GOAT_DISCARD_TITLE = 'Discard this goat?';

export function registerAddAnimalUnsavedHandlers(
  next: AddAnimalUnsavedHandlers,
): () => void {
  handlers = next;
  return () => {
    if (handlers === next) {
      handlers = null;
    }
  };
}

export function isOnAddGoatScreen(pathname: string): boolean {
  const path = pathname.split('?')[0];
  return path === '/livestock/add' || path.endsWith('/livestock/add');
}

/**
 * When leaving Add goat, ask before discarding. Returns true when navigation may proceed.
 * Concurrent callers share one in-flight confirm to avoid duplicate dialogs.
 */
export async function requestLeaveAddGoatScreen(): Promise<boolean> {
  if (!handlers?.isDirty()) {
    return true;
  }
  if (!confirmInFlight) {
    confirmInFlight = handlers.confirmDiscard().finally(() => {
      confirmInFlight = null;
    });
  }
  return confirmInFlight;
}

/** Run navigation only after the user confirms leaving a dirty Add goat form. */
export async function runAfterAddGoatLeaveConfirmed(
  action: () => void | Promise<void>,
): Promise<void> {
  const allowed = await requestLeaveAddGoatScreen();
  if (!allowed) {
    return;
  }
  await action();
}
