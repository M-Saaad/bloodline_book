# Supabase migrations

Run SQL files in numeric order:

1. `0001_extensions_and_tenancy.sql`
2. `0003_breeds_and_animals.sql`
3. `0004_weight_tracking.sql`
4. `0007_finances.sql`
5. `0008_farm_invites.sql`
6. `0009_documents_and_tasks.sql`

## PowerSync replication setup

After running migrations, execute in the Supabase SQL Editor:

```sql
CREATE ROLE powersync_role WITH REPLICATION BYPASSRLS LOGIN PASSWORD 'your-secure-password';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO powersync_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO powersync_role;
CREATE PUBLICATION powersync FOR ALL TABLES;
```

Connect this role in the PowerSync Dashboard and deploy `powersync/sync-rules.yaml`.
