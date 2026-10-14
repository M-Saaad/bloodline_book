import { recoveryParamsFromUrl } from '@/lib/auth/email';
import { INITIAL_WEB_URL } from '@/lib/supabase/initial-web-url';

export const RECOVERY_PENDING_STORAGE_KEY = 'bloodline.auth.recoveryPending';

export const RECOVERY_LINK_EXPIRED_MESSAGE =
  'This link has expired or was already used. Request a new one.';

export function isRecoveryTypeInUrl(url: string): boolean {
  const { type } = recoveryParamsFromUrl(url);
  return type === 'recovery';
}

export function recoveryLinkErrorFromUrl(url: string): string | null {
  const { error, errorCode } = recoveryParamsFromUrl(url);
  if (error || errorCode === 'otp_expired') {
    return RECOVERY_LINK_EXPIRED_MESSAGE;
  }
  return null;
}

export function recoveryLinkErrorFromInitialWebUrl(): string | null {
  if (!INITIAL_WEB_URL) {
    return null;
  }
  return recoveryLinkErrorFromUrl(INITIAL_WEB_URL);
}

export function isRecoveryTypeInInitialWebUrl(): boolean {
  if (!INITIAL_WEB_URL) {
    return false;
  }
  return isRecoveryTypeInUrl(INITIAL_WEB_URL);
}
