import { createBrowserClient } from "@supabase/ssr";
import { sanitizeSupabaseEnv } from "./env";

export function createClient() {
  sanitizeSupabaseEnv();
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
