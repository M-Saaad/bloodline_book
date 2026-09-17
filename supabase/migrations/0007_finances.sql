create table transactions (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  date date not null,
  amount numeric(12,2) not null,
  kind text not null check (kind in ('expense', 'revenue')),
  category text not null,
  notes text,
  created_at timestamptz not null default now()
);

alter table transactions enable row level security;

grant select, insert, update, delete on public.transactions to authenticated;

create policy "transactions_select" on transactions for select using (is_farm_member(farm_id));
create policy "transactions_insert" on transactions for insert with check (is_farm_member(farm_id, 'manager'));
create policy "transactions_update" on transactions for update using (is_farm_member(farm_id, 'manager'));
create policy "transactions_delete" on transactions for delete using (is_farm_member(farm_id, 'owner'));

create index idx_transactions_farm_date on transactions(farm_id, date desc);
