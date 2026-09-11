const EXPECTED_SUPABASE_PROJECT = "skwswkbuteaiysryelqy";

/** Strip accidental /rest/v1 paths copied from the API docs. */
export function normalizeSupabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return url.replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
  }
}

/** Repair JWTs whose header segment was pasted twice (header.header.payload.sig). */
export function normalizeSupabaseKey(token: string): string {
  const parts = token.split(".");
  if (parts.length === 4 && parts[0] === parts[1]) {
    return `${parts[0]}.${parts[2]}.${parts[3]}`;
  }
  return token;
}

export function supabaseUrl(): string {
  return normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
}

export function supabaseAnonKey(): string {
  return normalizeSupabaseKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "");
}

export function supabaseServiceRoleKey(): string {
  return normalizeSupabaseKey(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function supabaseProjectRef(): string | null {
  const url = supabaseUrl();
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
  const url = supabaseUrl();
  const anon = supabaseAnonKey();
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required");
  }
  if (process.env.NODE_ENV !== "production" && !isBloodlineBookDevEnv()) {
    console.warn(
      `[bloodline-book] NEXT_PUBLIC_SUPABASE_URL should point at ${EXPECTED_SUPABASE_PROJECT}, got: ${supabaseProjectRef() ?? url}`
    );
  }
  return { url, anon };
}
