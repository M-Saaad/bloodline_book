import { AuthError } from '@supabase/supabase-js';

export const AUTH_PASSWORD_HINT = 'At least 8 characters';

function isNetworkFailure(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('network error') ||
    message.includes('internet connection') ||
    message.includes('load failed')
  );
}

/**
 * Map Supabase auth errors (and network failures) to farmer-facing copy.
 */
export function mapAuthErrorMessage(error: unknown): string {
  if (isNetworkFailure(error)) {
    return 'You need an internet connection to sign in or create an account';
  }

  if (error instanceof AuthError) {
    const code = error.code ?? '';
    const message = error.message.toLowerCase();

    if (
      code === 'invalid_credentials' ||
      message.includes('invalid login credentials')
    ) {
      return 'Wrong email or password';
    }

    if (
      code === 'user_already_exists' ||
      message.includes('already registered') ||
      message.includes('already been registered')
    ) {
      return 'That email is already registered. Try signing in instead.';
    }

    if (
      code === 'weak_password' ||
      message.includes('password should be at least') ||
      message.includes('password is too weak')
    ) {
      return 'Password is too weak. Use at least 8 characters.';
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('invalid login credentials')) {
      return 'Wrong email or password';
    }
    if (message.includes('already registered')) {
      return 'That email is already registered. Try signing in instead.';
    }
  }

  return 'Something went wrong, please try again';
}
