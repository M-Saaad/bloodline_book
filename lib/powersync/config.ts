export function getPowerSyncUrl(): string {
  return process.env.EXPO_PUBLIC_POWERSYNC_URL?.trim() ?? '';
}

export function isPowerSyncConfigured(): boolean {
  const url = getPowerSyncUrl();
  return url.length > 0 && !url.includes('your-instance');
}
