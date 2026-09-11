-- Phase 2: milk/lactation, breeding exposure windows, vet contacts, farm gestation settings

create type milk_session as enum ('AM', 'PM', 'midday', 'once-daily', 'other');
create type milk_unit as enum ('lb', 'oz', 'fl-oz');
create type milk_measurement_method as enum ('scale', 'volume', 'estimate');
create type milk_source as enum ('farm-entered', 'dhia-test', 'lab-result', 'imported');
create type vet_contact_role as enum (
  'primary',
  'backup',
  'emergency clinic',
  'teaching hospital',
  'mobile practice',
  'poison control'
);

create table farm_settings (
  id integer primary key default 1 check (id = 1),
  gestation_days integer not null default 150,
  gestation_early_days integer not null default 5,
  gestation_late_days integer not null default 5,
  updated_at timestamptz not null default now()
);

insert into farm_settings (id) values (1) on conflict (id) do nothing;

create table milk_records (
  id uuid primary key default gen_random_uuid(),
  animal_id integer not null references animals(id) on delete cascade,
  date date not null,
  session milk_session not null default 'AM',
  amount_raw numeric(10,3) not null,
  unit_entered milk_unit not null default 'lb',
  amount_lb_normalized numeric(10,3) not null,
  measurement_method milk_measurement_method not null default 'scale',
  source milk_source not null default 'farm-entered',
  operator text,
  notes text,
  created_at timestamptz not null default now()
);

create table lactations (
  id uuid primary key default gen_random_uuid(),
  animal_id integer not null references animals(id) on delete cascade,
  freshening_date date not null,
  lactation_number integer not null default 1,
  dry_off_date date,
  notes text,
  created_at timestamptz not null default now()
);

create table vet_contacts (
  id uuid primary key default gen_random_uuid(),
  role vet_contact_role not null default 'primary',
  name text not null,
  phone text,
  emergency_phone text,
  address text,
  services_offered text,
  accepts_new_clients text default 'unknown',
  vcpr_established text default 'unknown',
  notes text,
  created_at timestamptz not null default now()
);

alter table breeding_events
  add column if not exists exposure_start_date date,
  add column if not exists exposure_end_date date,
  add column if not exists due_date_early date,
  add column if not exists due_date_late date;

-- Backfill exposure dates from legacy single date_crossed
update breeding_events
set
  exposure_start_date = coalesce(exposure_start_date, date_crossed),
  exposure_end_date = coalesce(exposure_end_date, date_crossed)
where date_crossed is not null
  and (exposure_start_date is null or exposure_end_date is null);

-- Backfill due date range from expected_due_date (±5 days default)
update breeding_events
set
  due_date_early = coalesce(due_date_early, expected_due_date - 5),
  due_date_late = coalesce(due_date_late, expected_due_date + 5)
where expected_due_date is not null
  and (due_date_early is null or due_date_late is null);

create index idx_milk_records_animal_date on milk_records(animal_id, date);
create index idx_lactations_animal on lactations(animal_id);
create index idx_vet_contacts_role on vet_contacts(role);

alter table farm_settings enable row level security;
alter table milk_records enable row level security;
alter table lactations enable row level security;
alter table vet_contacts enable row level security;

create policy "authenticated_all_farm_settings" on farm_settings for all to authenticated using (true) with check (true);
create policy "authenticated_all_milk_records" on milk_records for all to authenticated using (true) with check (true);
create policy "authenticated_all_lactations" on lactations for all to authenticated using (true) with check (true);
create policy "authenticated_all_vet_contacts" on vet_contacts for all to authenticated using (true) with check (true);
