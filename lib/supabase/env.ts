const EXPECTED_SUPABASE_PROJECT = "bloodline-book-dev";

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function supabaseProjectRef(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match?.[1] ?? null;
}

/** True when env points at the Bloodline Book dev project (not the production farm DB). */
export function isBloodlineBookDevEnv(): boolean {
  const ref = supabaseProjectRef();
  return ref === EXPECTED_SUPABASE_PROJECT;
}

export function requireSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required");
  }
  if (process.env.NODE_ENV !== "production" && !isBloodlineBookDevEnv()) {
    console.warn(
      `[bloodline-book] NEXT_PUBLIC_SUPABASE_URL should point at ${EXPECTED_SUPABASE_PROJECT}, got: ${supabaseProjectRef() ?? url}`
    );
  }
  return { url, anon };
}
