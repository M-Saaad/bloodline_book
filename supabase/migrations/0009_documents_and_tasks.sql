create table documents (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  animal_id uuid references animals(id) on delete set null,
  type text not null check (
    type in (
      'registration',
      'health_certificate',
      'scrapie_tag',
      'insurance',
      'transfer_paper',
      'other'
    )
  ),
  title text not null,
  storage_path text,
  notes text,
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  title text not null,
  due_date date,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  assigned_to uuid,
  source text not null default 'manual' check (
    source in ('manual', 'health', 'breeding', 'weaning', 'weigh_day', 'famacha_check')
  ),
  source_id uuid,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table documents enable row level security;
alter table tasks enable row level security;

grant select, insert, update, delete on public.documents to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;

create policy "documents_select" on documents for select using (is_farm_member(farm_id));
create policy "documents_insert" on documents for insert with check (is_farm_member(farm_id, 'manager'));
create policy "documents_update" on documents for update using (is_farm_member(farm_id, 'manager'));
create policy "documents_delete" on documents for delete using (is_farm_member(farm_id, 'owner'));

create policy "tasks_select" on tasks for select using (is_farm_member(farm_id));
create policy "tasks_insert" on tasks for insert with check (is_farm_member(farm_id, 'manager'));
create policy "tasks_update" on tasks for update using (is_farm_member(farm_id, 'manager'));
create policy "tasks_delete" on tasks for delete using (is_farm_member(farm_id, 'owner'));

create index idx_documents_farm on documents(farm_id);
create index idx_tasks_farm_due on tasks(farm_id, due_date) where completed = false;
