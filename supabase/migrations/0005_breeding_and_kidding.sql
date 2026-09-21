-- Phase 2: breeding calendar and kidding litter records.
-- animals.litter_id FK deferred from 0003.

create table kidding_events (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  dam_id uuid not null references animals(id) on delete restrict,
  sire_id uuid references animals(id) on delete set null,
  sire_external_name text,
  kid_date date not null,
  kids_born integer not null default 1 check (kids_born >= 0),
  kids_surviving integer check (kids_surviving is null or kids_surviving >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table breeding_events (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  dam_id uuid not null references animals(id) on delete restrict,
  sire_id uuid references animals(id) on delete set null,
  sire_external_name text,
  bred_date date not null,
  due_date date,
  status text not null default 'bred' check (
    status in ('bred', 'confirmed', 'open', 'kidded', 'dry')
  ),
  kidding_event_id uuid references kidding_events(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table animals
  add constraint animals_litter_id_fkey
  foreign key (litter_id) references kidding_events(id) on delete set null;

alter table kidding_events enable row level security;
alter table breeding_events enable row level security;

grant select, insert, update, delete on public.kidding_events to authenticated;
grant select, insert, update, delete on public.breeding_events to authenticated;

create policy "kidding_events_select" on kidding_events for select
  using (is_farm_member(farm_id));
create policy "kidding_events_insert" on kidding_events for insert
  with check (is_farm_member(farm_id, 'manager'));
create policy "kidding_events_update" on kidding_events for update
  using (is_farm_member(farm_id, 'manager'));
create policy "kidding_events_delete" on kidding_events for delete
  using (is_farm_member(farm_id, 'owner'));

create policy "breeding_events_select" on breeding_events for select
  using (is_farm_member(farm_id));
create policy "breeding_events_insert" on breeding_events for insert
  with check (is_farm_member(farm_id, 'manager'));
create policy "breeding_events_update" on breeding_events for update
  using (is_farm_member(farm_id, 'manager'));
create policy "breeding_events_delete" on breeding_events for delete
  using (is_farm_member(farm_id, 'owner'));

create index idx_kidding_events_farm_date on kidding_events(farm_id, kid_date desc);
create index idx_kidding_events_dam on kidding_events(dam_id);
create index idx_breeding_events_farm_due on breeding_events(farm_id, due_date);
create index idx_breeding_events_dam on breeding_events(dam_id);
