-- Waitlist for the public landing page (bloodlinebookapp.com, site/index.html).
-- Visitors can add a row with the public anon key. Nobody can read, change or
-- delete rows with that key; read them in the Supabase dashboard (service role).

create table if not exists waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null
    check (char_length(email) between 5 and 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  records_now text check (records_now is null or char_length(records_now) <= 40),
  herd_size text check (herd_size is null or char_length(herd_size) <= 40),
  annoying_part text check (annoying_part is null or char_length(annoying_part) <= 300),
  source text check (source is null or char_length(source) <= 80)
);

alter table waitlist_signups enable row level security;

revoke all on waitlist_signups from anon, authenticated;
grant insert on waitlist_signups to anon, authenticated;

drop policy if exists waitlist_signups_insert on waitlist_signups;
create policy waitlist_signups_insert on waitlist_signups
  for insert to anon, authenticated
  with check (true);

notify pgrst, 'reload schema';
