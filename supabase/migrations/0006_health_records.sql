-- Phase 2: per-animal health events (vaccination, FAMACHA, treatments, etc.).

create table health_records (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  animal_id uuid not null references animals(id) on delete cascade,
  date date not null,
  kind text not null check (
    kind in (
      'vaccination',
      'treatment',
      'famacha',
      'deworming',
      'injury',
      'hoof_trim',
      'other'
    )
  ),
  famacha_score integer check (
    famacha_score is null or (famacha_score >= 1 and famacha_score <= 5)
  ),
  product_name text,
  dosage text,
  withdrawal_days integer check (withdrawal_days is null or withdrawal_days >= 0),
  notes text,
  created_at timestamptz not null default now()
);

alter table health_records enable row level security;

grant select, insert, update, delete on public.health_records to authenticated;

create policy "health_records_select" on health_records for select
  using (is_farm_member(farm_id));
create policy "health_records_insert" on health_records for insert
  with check (is_farm_member(farm_id, 'manager'));
create policy "health_records_update" on health_records for update
  using (is_farm_member(farm_id, 'manager'));
create policy "health_records_delete" on health_records for delete
  using (is_farm_member(farm_id, 'owner'));

create index idx_health_records_farm_date on health_records(farm_id, date desc);
create index idx_health_records_animal on health_records(animal_id, date desc);
