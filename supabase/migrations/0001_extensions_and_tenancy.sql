create extension if not exists "pgcrypto";

create table farms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  segment text not null check (segment in ('dairy', 'meat', 'both')),
  currency text not null default 'USD',
  weight_unit text not null default 'lb' check (weight_unit in ('lb', 'kg')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table farm_members (
  farm_id uuid not null references farms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'hand')),
  equity_share numeric(5,2),
  created_at timestamptz not null default now(),
  primary key (farm_id, user_id)
);

alter table farms enable row level security;
alter table farm_members enable row level security;

grant select, insert, update, delete on public.farms to authenticated;
grant select, insert, update, delete on public.farm_members to authenticated;

create or replace function public.handle_new_farm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.farm_members (farm_id, user_id, role)
  values (new.id, auth.uid(), 'owner');
  return new;
end;
$$;

create trigger on_farm_created
  after insert on farms
  for each row
  execute function public.handle_new_farm();

create or replace function public.is_farm_member(target_farm_id uuid, min_role text default 'hand')
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from farm_members
    where farm_id = target_farm_id
      and user_id = auth.uid()
      and (
        min_role = 'hand'
        or (min_role = 'manager' and role in ('manager', 'owner'))
        or (min_role = 'owner' and role = 'owner')
      )
  );
$$;

create policy "farms_select" on farms for select using (is_farm_member(id));
create policy "farms_update" on farms for update using (is_farm_member(id, 'owner'));
create policy "farms_insert" on farms for insert with check (auth.uid() is not null);

create policy "farm_members_select" on farm_members for select using (is_farm_member(farm_id));
create policy "farm_members_manage" on farm_members for all
  using (is_farm_member(farm_id, 'owner'))
  with check (is_farm_member(farm_id, 'owner'));
