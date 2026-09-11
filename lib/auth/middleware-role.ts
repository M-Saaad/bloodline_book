import type { UserRole } from "./roles";

export const FARM_ROLE_HEADER = "x-farm-user-role";

export function parseRoleHeader(value: string | null): UserRole | null {
  if (value === "partner" || value === "guest") return value;
  return null;
}
