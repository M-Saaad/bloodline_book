create table farm_invites (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  email text not null,
  role text not null check (role in ('manager', 'hand')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  unique (farm_id, email)
);

alter table farm_invites enable row level security;

grant select, insert, update, delete on public.farm_invites to authenticated;

create policy "farm_invites_select" on farm_invites for select using (is_farm_member(farm_id));
create policy "farm_invites_insert" on farm_invites for insert with check (is_farm_member(farm_id, 'owner'));
create policy "farm_invites_update" on farm_invites for update using (is_farm_member(farm_id, 'owner'));
create policy "farm_invites_delete" on farm_invites for delete using (is_farm_member(farm_id, 'owner'));

create index idx_farm_invites_farm on farm_invites(farm_id);

create or replace function public.accept_farm_invites_for_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.farm_members (farm_id, user_id, role)
  select fi.farm_id, new.id, fi.role
  from public.farm_invites fi
  where lower(fi.email) = lower(new.email)
    and fi.status = 'pending'
  on conflict (farm_id, user_id) do nothing;

  update public.farm_invites fi
  set status = 'accepted'
  where lower(fi.email) = lower(new.email)
    and fi.status = 'pending';

  return new;
end;
$$;

create trigger on_auth_user_created_accept_invites
  after insert on auth.users
  for each row
  execute function public.accept_farm_invites_for_user();
