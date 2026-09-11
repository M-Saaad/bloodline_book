import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { FARM_ROLE_HEADER, parseRoleHeader } from "@/lib/auth/middleware-role";

export type UserRole = "partner" | "guest";

function isUserRole(value: string): value is UserRole {
  return value === "partner" || value === "guest";
}

/** Role for the current session, or null when not signed in. */
export async function getSessionRole(): Promise<UserRole | null> {
  if (!isSupabaseConfigured()) {
    return "partner";
  }

  const headerStore = await headers();
  const fromMiddleware = parseRoleHeader(headerStore.get(FARM_ROLE_HEADER));
  if (fromMiddleware) return fromMiddleware;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    // Migration not applied yet — keep existing partner behavior.
    return "partner";
  }

  const role = profile?.role;
  if (typeof role === "string" && isUserRole(role)) {
    return role;
  }

  return "partner";
}

export async function getWriteAccess(): Promise<boolean> {
  const role = await getSessionRole();
  return role === "partner";
}

export async function requirePartner(): Promise<void> {
  if (!(await getWriteAccess())) {
    throw new Error("View-only access: you cannot make changes");
  }
}
