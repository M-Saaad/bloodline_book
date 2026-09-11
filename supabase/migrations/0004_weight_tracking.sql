create table weigh_sessions (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  date date not null,
  weigh_point text not null check (
    weigh_point in ('birth', '30_day', '60_day', '90_day', 'weaning', 'yearling', 'ad_hoc')
  ),
  notes text,
  created_at timestamptz not null default now()
);

create table weight_logs (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  weigh_session_id uuid not null references weigh_sessions(id) on delete cascade,
  animal_id uuid not null references animals(id) on delete cascade,
  weight_value numeric(8,2) not null,
  weight_unit text not null default 'lb' check (weight_unit in ('lb', 'kg')),
  created_at timestamptz not null default now()
);

alter table weigh_sessions enable row level security;
alter table weight_logs enable row level security;

grant select, insert, update, delete on public.weigh_sessions to authenticated;
grant select, insert, update, delete on public.weight_logs to authenticated;

create policy "weigh_sessions_select" on weigh_sessions for select using (is_farm_member(farm_id));
create policy "weigh_sessions_insert" on weigh_sessions for insert with check (is_farm_member(farm_id, 'manager'));
create policy "weigh_sessions_update" on weigh_sessions for update using (is_farm_member(farm_id, 'manager'));
create policy "weigh_sessions_delete" on weigh_sessions for delete using (is_farm_member(farm_id, 'owner'));

create policy "weight_logs_select" on weight_logs for select using (is_farm_member(farm_id));
create policy "weight_logs_insert" on weight_logs for insert with check (is_farm_member(farm_id, 'manager'));
create policy "weight_logs_update" on weight_logs for update using (is_farm_member(farm_id, 'manager'));
create policy "weight_logs_delete" on weight_logs for delete using (is_farm_member(farm_id, 'owner'));

create index idx_weight_logs_animal on weight_logs(animal_id);
create index idx_weight_logs_session on weight_logs(weigh_session_id);
