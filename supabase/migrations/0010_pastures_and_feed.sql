-- Phase 3: pastures, grazing occupancy, and feed logs.

create table pastures (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  name text not null,
  acres numeric(10,2),
  forage_type text not null default 'mixed' check (
    forage_type in (
      'mixed',
      'bermuda',
      'clover',
      'browse',
      'hayfield',
      'other'
    )
  ),
  status text not null default 'resting' check (
    status in ('grazing', 'resting', 'hay', 'overgrazed')
  ),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table grazing_records (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  pasture_id uuid not null references pastures(id) on delete cascade,
  animal_id uuid not null references animals(id) on delete cascade,
  start_date date not null,
  end_date date,
  notes text,
  created_at timestamptz not null default now()
);

create table feed_logs (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  date date not null,
  feed_type text not null,
  quantity numeric(12,2),
  unit text not null default 'lb' check (unit in ('lb', 'kg', 'bale', 'bag')),
  pasture_id uuid references pastures(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

alter table pastures enable row level security;
alter table grazing_records enable row level security;
alter table feed_logs enable row level security;

grant select, insert, update, delete on public.pastures to authenticated;
grant select, insert, update, delete on public.grazing_records to authenticated;
grant select, insert, update, delete on public.feed_logs to authenticated;

create policy "pastures_select" on pastures for select using (is_farm_member(farm_id));
create policy "pastures_insert" on pastures for insert with check (is_farm_member(farm_id, 'manager'));
create policy "pastures_update" on pastures for update using (is_farm_member(farm_id, 'manager'));
create policy "pastures_delete" on pastures for delete using (is_farm_member(farm_id, 'owner'));

create policy "grazing_select" on grazing_records for select using (is_farm_member(farm_id));
create policy "grazing_insert" on grazing_records for insert with check (is_farm_member(farm_id, 'manager'));
create policy "grazing_update" on grazing_records for update using (is_farm_member(farm_id, 'manager'));
create policy "grazing_delete" on grazing_records for delete using (is_farm_member(farm_id, 'owner'));

create policy "feed_logs_select" on feed_logs for select using (is_farm_member(farm_id));
create policy "feed_logs_insert" on feed_logs for insert with check (is_farm_member(farm_id, 'manager'));
create policy "feed_logs_update" on feed_logs for update using (is_farm_member(farm_id, 'manager'));
create policy "feed_logs_delete" on feed_logs for delete using (is_farm_member(farm_id, 'owner'));

create index idx_pastures_farm on pastures(farm_id);
create index idx_grazing_farm_open on grazing_records(farm_id, pasture_id)
  where end_date is null;
create index idx_grazing_animal_open on grazing_records(animal_id)
  where end_date is null;
create index idx_feed_logs_farm_date on feed_logs(farm_id, date desc);
