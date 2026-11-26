-- Tag history, kid colour, and birth order.
-- Additive only. Current tag_number / official_id / tattoo stay the live values.
-- Safe to re-run: existing columns, table, policies, indexes, and backfill rows are skipped.
-- Current tag values are not unique in the database. Several farms already share a tag.
-- The app warns on save and names the other goat. Uploads are not rejected for that.

alter table animals add column if not exists color text;

alter table animals add column if not exists birth_order smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'animals_birth_order_positive'
  ) then
    alter table animals
      add constraint animals_birth_order_positive
      check (birth_order is null or birth_order >= 1);
  end if;
end $$;

create table if not exists tag_history (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  animal_id uuid not null references animals(id) on delete cascade,
  kind text not null check (kind in ('farm_tag', 'official_id', 'tattoo')),
  value text not null check (btrim(value) <> ''),
  started_on date,
  ended_on date,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  check (ended_on is null or started_on is null or ended_on >= started_on)
);

alter table tag_history enable row level security;

grant select, insert, update, delete on public.tag_history to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'powersync_role') then
    grant select on public.tag_history to powersync_role;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tag_history' and policyname = 'tag_history_select'
  ) then
    create policy "tag_history_select" on tag_history for select
      using (is_farm_member(farm_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tag_history' and policyname = 'tag_history_insert'
  ) then
    create policy "tag_history_insert" on tag_history for insert
      with check (is_farm_member(farm_id, 'manager'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tag_history' and policyname = 'tag_history_update'
  ) then
    create policy "tag_history_update" on tag_history for update
      using (is_farm_member(farm_id, 'manager'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tag_history' and policyname = 'tag_history_delete'
  ) then
    create policy "tag_history_delete" on tag_history for delete
      using (is_farm_member(farm_id, 'owner'));
  end if;
end $$;

create index if not exists idx_tag_history_animal on tag_history(animal_id, ended_on);
create index if not exists idx_tag_history_farm on tag_history(farm_id);

-- One current history row per non-empty tag already stored on the animal.
insert into tag_history (farm_id, animal_id, kind, value, started_on, ended_on, note, created_by)
select a.farm_id, a.id, 'farm_tag', btrim(a.tag_number), null, null, null, null
from animals a
where nullif(btrim(a.tag_number), '') is not null
  and not exists (
    select 1 from tag_history h
    where h.animal_id = a.id
      and h.kind = 'farm_tag'
      and h.ended_on is null
  );

insert into tag_history (farm_id, animal_id, kind, value, started_on, ended_on, note, created_by)
select a.farm_id, a.id, 'official_id', btrim(a.official_id), null, null, null, null
from animals a
where nullif(btrim(a.official_id), '') is not null
  and not exists (
    select 1 from tag_history h
    where h.animal_id = a.id
      and h.kind = 'official_id'
      and h.ended_on is null
  );

insert into tag_history (farm_id, animal_id, kind, value, started_on, ended_on, note, created_by)
select a.farm_id, a.id, 'tattoo', btrim(a.tattoo), null, null, null, null
from animals a
where nullif(btrim(a.tattoo), '') is not null
  and not exists (
    select 1 from tag_history h
    where h.animal_id = a.id
      and h.kind = 'tattoo'
      and h.ended_on is null
  );

-- One open history row per goat and kind. The same tag text may be current on more than one goat.
create unique index if not exists tag_history_one_current_per_kind
  on tag_history (animal_id, kind)
  where ended_on is null;
