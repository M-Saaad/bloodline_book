-- Phase 0: animals.litter_id column included; FK to kidding_events added in 0005.

create table breeds (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid references farms(id) on delete cascade,
  name text not null,
  segment text not null check (segment in ('dairy', 'meat', 'both')),
  created_at timestamptz not null default now()
);

insert into breeds (farm_id, name, segment) values
  (null, 'Nigerian Dwarf', 'dairy'),
  (null, 'Nubian', 'dairy'),
  (null, 'LaMancha', 'dairy'),
  (null, 'Alpine', 'dairy'),
  (null, 'Saanen', 'dairy'),
  (null, 'Boer', 'meat'),
  (null, 'Kalahari Red', 'meat'),
  (null, 'Kiko', 'meat'),
  (null, 'Spanish', 'meat'),
  (null, 'Savanna', 'meat');

create table animals (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  name text,
  tag_number text,
  photo_storage_path text,
  breed_primary_id uuid references breeds(id),
  breed_percentage numeric(5,2),
  sex text not null check (sex in ('male', 'female')),
  date_of_birth date,
  status text not null default 'active' check (status in ('active', 'sold', 'died', 'slaughtered', 'transferred')),
  lifecycle_stage text not null default 'kid' check (
    lifecycle_stage in ('kid', 'weaned', 'yearling', 'breeding', 'feeder', 'market_ready', 'adult')
  ),
  purpose text check (purpose in ('dairy', 'meat', 'breeding_stock')),
  dam_id uuid references animals(id),
  sire_id uuid references animals(id),
  sire_external_name text,
  litter_id uuid,
  registration_body text check (registration_body in ('adga', 'abga', 'usbga', 'other')),
  registration_number text,
  tattoo text,
  purchase_price numeric(12,2),
  sold_price numeric(12,2),
  purchased_from_id uuid,
  out_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table breeds enable row level security;
alter table animals enable row level security;

grant select, insert, update, delete on public.breeds to authenticated;
grant select, insert, update, delete on public.animals to authenticated;

create policy "breeds_select_global_or_own" on breeds for select
  using (farm_id is null or is_farm_member(farm_id));
create policy "breeds_insert_own_farm" on breeds for insert
  with check (farm_id is not null and is_farm_member(farm_id, 'manager'));
create policy "breeds_update" on breeds for update using (farm_id is not null and is_farm_member(farm_id, 'manager'));
create policy "breeds_delete" on breeds for delete using (farm_id is not null and is_farm_member(farm_id, 'owner'));

create policy "animals_select" on animals for select using (is_farm_member(farm_id));
create policy "animals_insert" on animals for insert with check (is_farm_member(farm_id, 'manager'));
create policy "animals_update" on animals for update using (is_farm_member(farm_id, 'manager'));
create policy "animals_delete" on animals for delete using (is_farm_member(farm_id, 'owner'));

create index idx_animals_farm on animals(farm_id);
create index idx_animals_status on animals(farm_id, status);
create index idx_animals_dam on animals(dam_id);
create index idx_animals_sire on animals(sire_id);
