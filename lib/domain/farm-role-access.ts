import type { FarmMember } from '@/lib/types/tenancy';

export type FarmMemberRole = FarmMember['role'];

/** Shown when the user cannot add or edit farm records (hand or role not loaded). */
export const VIEW_ONLY_FARM_MESSAGE =
  'View only: ask the farm owner for manager access.';

/** Only owners and managers may write. Unknown role is read-only (pending vs confirmed in resolveFarmRoleCapabilities). */
export function farmRoleCanWrite(role: FarmMemberRole | null): boolean {
  return role === 'owner' || role === 'manager';
}

export function farmRoleIsHand(role: FarmMemberRole | null): boolean {
  return role === 'hand';
}

export const FARM_WRITE_FORBIDDEN_MESSAGE = VIEW_ONLY_FARM_MESSAGE;

export function parseFarmMemberRole(
  raw: string | null | undefined,
): FarmMemberRole | null {
  if (raw === 'owner' || raw === 'manager' || raw === 'hand') {
    return raw;
  }
  return null;
}

export type FarmRoleLoadState = {
  localLoading: boolean;
  fallbackLoading: boolean;
};

export type FarmRoleCapabilities = {
  canWrite: boolean;
  isHand: boolean;
  /** True while role is unknown (local query or online fallback in flight). */
  isRolePending: boolean;
  /** Show view-only banner (confirmed hand, or no membership after loads finished). */
  showReadOnlyBanner: boolean;
};

export function resolveFarmRoleCapabilities(
  role: FarmMemberRole | null,
  load: FarmRoleLoadState,
): FarmRoleCapabilities {
  const isRolePending =
    role === null && (load.localLoading || load.fallbackLoading);
  const canWrite = farmRoleCanWrite(role);
  const isHand = farmRoleIsHand(role);
  const showReadOnlyBanner = isHand || (role === null && !isRolePending);
  return { canWrite, isHand, isRolePending, showReadOnlyBanner };
}