import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseEnv, supabaseServiceRoleKey } from "./env";

/** Service-role client for seed scripts and privileged server writes. Never expose to browser. */
export function createServiceClient() {
  const { url } = requireSupabaseEnv();
  const key = supabaseServiceRoleKey();
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for server/seed writes");
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
