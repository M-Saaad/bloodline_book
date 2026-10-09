/**
 * Text size preference. Pure helpers only (no React Native imports) so the
 * logic can be tested with plain node. The choice is a per-device setting:
 * it is stored on the phone and never synced to the database.
 */

export type TextSizeKey = 'small' | 'default' | 'large' | 'xlarge';

export const TEXT_SIZE_OPTIONS: {
  key: TextSizeKey;
  label: string;
  scale: number;
}[] = [
  { key: 'small', label: 'Small', scale: 0.8 },
  { key: 'default', label: 'Default', scale: 0.9 },
  { key: 'large', label: 'Large', scale: 1 },
  { key: 'xlarge', label: 'Extra large', scale: 1.2 },
];

export const DEFAULT_TEXT_SIZE: TextSizeKey = 'default';
export const TEXT_SIZE_STORAGE_KEY = 'bloodline.textSize.v2';
/** Previous per-device key (four options with older scale steps). */
export const LEGACY_TEXT_SIZE_STORAGE_KEY = 'bloodline.textSize';
/** Set when the farmer finishes the one-time text size welcome screen. */
export const TEXT_SIZE_ONBOARDING_KEY = 'bloodline.textSizeOnboarding.v1';

const LEGACY_STORED_KEY_TO_V2: Record<TextSizeKey, TextSizeKey> = {
  small: 'default',
  default: 'large',
  large: 'xlarge',
  xlarge: 'xlarge',
};

/** Map a stored v1 choice to the closest v2 key (same visual size where possible). */
export function migrateLegacyStoredTextSize(key: TextSizeKey): TextSizeKey {
  return LEGACY_STORED_KEY_TO_V2[key];
}

/** Our scale times the phone's own font scale never goes past this. */
export const MAX_COMBINED_SCALE = 1.6;

/** React Native's font size when a Text sets none. */
export const RN_DEFAULT_FONT_SIZE = 14;

export function isTextSizeKey(value: unknown): value is TextSizeKey {
  return TEXT_SIZE_OPTIONS.some((option) => option.key === value);
}

export function parseTextSize(raw: unknown): TextSizeKey {
  return isTextSizeKey(raw) ? raw : DEFAULT_TEXT_SIZE;
}

export function hasStoredTextSizeChoice(
  v2Raw: string | null | undefined,
  legacyRaw: string | null | undefined,
): boolean {
  if (v2Raw != null && isTextSizeKey(v2Raw)) {
    return true;
  }
  if (legacyRaw != null && isTextSizeKey(legacyRaw)) {
    return true;
  }
  return false;
}

/** Skip the welcome screen for upgrades that already picked a size in Settings. */
export function isTextSizeOnboardingComplete(
  onboardingFlag: string | null | undefined,
  v2Raw: string | null | undefined,
  legacyRaw: string | null | undefined,
): boolean {
  if (onboardingFlag === '1') {
    return true;
  }
  return hasStoredTextSizeChoice(v2Raw, legacyRaw);
}

export function scaleForTextSize(key: TextSizeKey): number {
  return TEXT_SIZE_OPTIONS.find((option) => option.key === key)?.scale ?? 1;
}

/**
 * Cap for the phone's own font scale (RN `maxFontSizeMultiplier`) so that
 * our scale times the system scale stays at or under MAX_COMBINED_SCALE.
 * Never below 1, so the phone setting is always respected at least at 1x.
 */
export function systemFontCap(scale: number): number {
  if (!(scale > 0)) {
    return 1;
  }
  return Math.max(1, MAX_COMBINED_SCALE / scale);
}

type FontStyle = { fontSize?: unknown; lineHeight?: unknown };

function roundHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

/**
 * Returns a copy of `style` with fontSize and lineHeight multiplied by
 * `scale`. A Text with no fontSize is treated as 14, React Native's default.
 * Returns `style` unchanged at 1x so the default path costs nothing.
 */
export function scaleFontStyle<T extends FontStyle>(
  style: T | undefined,
  scale: number,
): T | undefined {
  if (scale === 1) {
    return style;
  }
  const next: FontStyle = { ...(style ?? {}) };
  const size = typeof next.fontSize === 'number' ? next.fontSize : undefined;
  next.fontSize = roundHalf((size ?? RN_DEFAULT_FONT_SIZE) * scale);
  if (typeof next.lineHeight === 'number') {
    next.lineHeight = roundHalf(next.lineHeight * scale);
  }
  return next as T;
}
