import type { FarmMember } from '@/lib/types/tenancy';

export type FarmMemberRole = FarmMember['role'];

/** Shown when the user cannot add or edit farm records (hand or role not loaded). */
export const VIEW_ONLY_FARM_MESSAGE =
  'View only: ask the farm owner for manager access.';

/** Only owners and managers may write; unknown or loading roles are read-only. */
export function farmRoleCanWrite(
  role: FarmMemberRole | null,
  roleLoading: boolean,
): boolean {
  if (roleLoading) {
    return false;
  }
  return role === 'owner' || role === 'manager';
}

export function farmRoleIsHand(role: FarmMemberRole | null): boolean {
  return role === 'hand';
}