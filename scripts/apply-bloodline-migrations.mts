/**
 * Apply Bloodline Book schema to the configured Supabase project.
 * Requires DATABASE_URL / POSTGRES_URL or SUPABASE_ACCESS_TOKEN.
 *
 * Usage: npx tsx --env-file=.env.local scripts/apply-bloodline-migrations.mts
 */
import { applyMigrationFile, postgresEnvStatus, supabaseProjectRef } from "../lib/supabase/postgres-url.ts";

const MIGRATIONS = ["001_initial_schema.sql", "002_structured_medical_events.sql"] as const;

function normalizeSupabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return url.replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
  }
}

function normalizeSupabaseJwt(token: string): string {
  const parts = token.split(".");
  if (parts.length === 4 && parts[0] === parts[1]) {
    return `${parts[0]}.${parts[2]}.${parts[3]}`;
  }
  return token;
}

function sanitizeInjectedEnv(): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (url) process.env.NEXT_PUBLIC_SUPABASE_URL = normalizeSupabaseUrl(url);
  for (const key of ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const) {
    const value = process.env[key];
    if (value) process.env[key] = normalizeSupabaseJwt(value);
  }
}

async function main() {
  sanitizeInjectedEnv();
  const ref = supabaseProjectRef() ?? "unknown";
  console.log("Project ref:", ref);
  console.log("Postgres/management env:", postgresEnvStatus());

  for (const filename of MIGRATIONS) {
    console.log(`\nApplying ${filename}...`);
    const result = await applyMigrationFile(filename);
    if (!result.ok) {
      console.error(`FAILED ${filename} via ${result.method}: ${result.detail}`);
      process.exit(1);
    }
    console.log(`OK ${filename} via ${result.method}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
