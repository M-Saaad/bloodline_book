export type SignedInEntryRoute = 'reset-password' | 'app';

/**
 * Where a signed-in user should land from the root index and auth guards.
 * Recovery must win over the normal dashboard path until the password is saved.
 */
export function signedInEntryRoute(input: {
  recoveryPending: boolean;
  hasSession: boolean;
}): SignedInEntryRoute | 'sign-in' {
  if (!input.hasSession) {
    return 'sign-in';
  }
  if (input.recoveryPending) {
    return 'reset-password';
  }
  return 'app';
}

export function shouldRedirectToResetPassword(input: {
  recoveryPending: boolean;
  recoveryLinkError: string | null;
}): boolean {
  return input.recoveryPending || input.recoveryLinkError != null;
}
