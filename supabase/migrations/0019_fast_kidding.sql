-- Fast kidding: birth weights without a weigh session, and a per-season
-- "not bred / open" mark so a doe can leave the not-kidded list.
-- Additive and safe to re-run. Apply this in the Supabase SQL editor BEFORE
-- deploying the PowerSync sync rules that select kidding_season_marks.
-- Leaves existing tables and columns in place.
-- weigh_session_id stays a uuid and still references weigh_sessions.
-- Existing weight rows keep their session. New birth weights may leave it null.
-- The kid's date of birth is the date of that weight.

alter table weight_logs alter column weigh_session_id drop not null;

alter table farms add column if not exists kidding_season_start date;

create table if not exists kidding_season_marks (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  animal_id uuid not null references animals(id) on delete cascade,
  season_start date not null,
  kind text not null default 'open' check (kind in ('open')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table kidding_season_marks enable row level security;

grant select, insert, update, delete on public.kidding_season_marks to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'powersync_role') then
    grant select on public.kidding_season_marks to powersync_role;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'kidding_season_marks'
      and policyname = 'kidding_season_marks_select'
  ) then
    create policy "kidding_season_marks_select" on kidding_season_marks
      for select using (is_farm_member(farm_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'kidding_season_marks'
      and policyname = 'kidding_season_marks_insert'
  ) then
    create policy "kidding_season_marks_insert" on kidding_season_marks
      for insert with check (is_farm_member(farm_id, 'manager'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'kidding_season_marks'
      and policyname = 'kidding_season_marks_update'
  ) then
    create policy "kidding_season_marks_update" on kidding_season_marks
      for update using (is_farm_member(farm_id, 'manager'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'kidding_season_marks'
      and policyname = 'kidding_season_marks_delete'
  ) then
    create policy "kidding_season_marks_delete" on kidding_season_marks
      for delete using (is_farm_member(farm_id, 'owner'));
  end if;
end $$;

create index if not exists idx_kidding_season_marks_farm
  on kidding_season_marks(farm_id, season_start);

create unique index if not exists kidding_season_marks_animal_season
  on kidding_season_marks(animal_id, season_start);
