type AddAnimalUnsavedHandlers = {
  isDirty: () => boolean;
  confirmDiscard: () => Promise<boolean>;
};

let handlers: AddAnimalUnsavedHandlers | null = null;

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
 * When leaving Add goat via tab bar (or other non-stack paths), ask before discarding.
 * Returns true when navigation may proceed.
 */
export async function requestLeaveAddGoatScreen(): Promise<boolean> {
  if (!handlers?.isDirty()) {
    return true;
  }
  return handlers.confirmDiscard();
}
