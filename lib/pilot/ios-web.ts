/** Keys stored on the device (web only). */
export const IOS_BROWSER_CONTINUE_KEY = 'bloodline:ios-browser-continue';
export const WEB_STORAGE_PERSIST_FLAG_KEY = 'bloodline:web-storage-persist-requested';

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  const ua = navigator.userAgent;
  const iosUa = /iPad|iPhone|iPod/.test(ua);
  const ipadOs =
    navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iosUa || ipadOs;
}

/** Safari in the browser tab — not Chrome/Firefox on iOS, not the home-screen app. */
export function isIosSafariBrowser(): boolean {
  if (!isIosDevice() || typeof navigator === 'undefined') {
    return false;
  }
  const ua = navigator.userAgent;
  if (/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) {
    return false;
  }
  return /Safari/.test(ua);
}

export function isStandaloneWebApp(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) {
    return true;
  }
  try {
    return window.matchMedia('(display-mode: standalone)').matches;
  } catch {
    return false;
  }
}

export function shouldShowIosAddToHomeGate(
  pathname: string,
  continueInBrowser: boolean,
): boolean {
  if (continueInBrowser) {
    return false;
  }
  if (pathname === '/install' || pathname === '/guide') {
    return false;
  }
  if (pathname.startsWith('/reset-password')) {
    return false;
  }
  return isIosSafariBrowser() && !isStandaloneWebApp();
}
