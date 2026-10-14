/** Captured at module load, before Supabase clears the hash via `detectSessionInUrl`. */
export const INITIAL_WEB_URL: string | null =
  typeof window !== 'undefined' ? window.location.href : null;
