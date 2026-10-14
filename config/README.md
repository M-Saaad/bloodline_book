# Build-time public config

`vercel-development-public.env` holds **dev** `EXPO_PUBLIC_*` values (Supabase anon key and PowerSync URL are client-visible). Vercel Preview uses this file only when Preview-scoped dashboard vars are missing, so PR exports still build.
