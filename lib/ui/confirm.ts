type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  resolve: (confirmed: boolean) => void;
};

let opener: ((request: ConfirmRequest) => void) | null = null;
const queue: ConfirmRequest[] = [];

export function registerConfirmOpener(
  next: (request: ConfirmRequest) => void,
): () => void {
  opener = next;
  const waiting = queue.splice(0, queue.length);
  for (const request of waiting) {
    next(request);
  }
  return () => {
    if (opener === next) {
      opener = null;
    }
  };
}

/**
 * In-app confirm. Buttons use the labels you pass.
 * A blocked browser confirm() used to return false and take the "no" path.
 */
export function confirmAction(
  title: string,
  message: string,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
): Promise<boolean> {
  return new Promise((resolve) => {
    const request: ConfirmRequest = {
      title,
      message,
      confirmLabel,
      cancelLabel,
      resolve,
    };
    if (opener) {
      opener(request);
      return;
    }
    queue.push(request);
  });
}
