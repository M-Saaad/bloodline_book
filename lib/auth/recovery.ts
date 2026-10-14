import { recoveryParamsFromUrl } from '@/lib/auth/email';

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

export function recoveryLinkErrorFromWebLocation(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return recoveryLinkErrorFromUrl(window.location.href);
}

export function isRecoveryTypeInWebHash(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!hash) {
    return false;
  }
  return new URLSearchParams(hash).get('type') === 'recovery';
}
