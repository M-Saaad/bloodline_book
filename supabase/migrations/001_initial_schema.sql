-- Bloodline Book — initial schema (single-owner farm, no Palai / partner equity)
-- Fresh migration history starting at 001 for the bloodline-book-dev Supabase project.

create extension if not exists "pgcrypto";

create type animal_status as enum ('Active', 'Died', 'Sold', 'Slaughtered', 'Gone');
create type animal_sex as enum ('Male', 'Female');
create type animal_breed as enum ('Gulabi', 'Teddy', 'Bissar', 'Tapra');
create type contact_type as enum ('Vendor', 'Customer', 'Farm');
create type transaction_kind as enum ('cost', 'income');
create type ledger_category as enum (
  'Feed',
  'Delivery',
  'Vet/Medicine',
  'Labor',
  'Infrastructure',
  'Livestock Purchase',
  'Livestock Sale',
  'Other'
);
create type medical_event_type as enum (
  'Vaccine',
  'Deworming',
  'Ultrasound',
  'Surgery',
  'General'
);
create type breeding_outcome as enum ('Pending', 'Delivered', 'Stillbirth', 'Miscarriage', 'Doubt');
create type breeding_status as enum ('Ready', 'Doubt', 'Delivered', 'Kid');
create type agreement_status as enum ('open', 'settled');
create type media_type as enum ('image', 'video');
create type user_role as enum ('owner', 'guest');

create table contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  type contact_type not null,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);

create table animals (
  id integer primary key,
  name text,
  breed animal_breed,
  sex animal_sex,
  date_of_purchase date,
  age_at_purchase text,
  description text,
  comment text,
  status animal_status not null default 'Active',
  price numeric(12,2) default 0,
  sold_price numeric(12,2),
  purchased_from uuid references contacts(id),
  owner_id uuid references contacts(id),
  home_bred boolean default false,
  dam_id integer references animals(id),
  sire_id integer references animals(id),
  sire_name text,
  out_date date,
  created_at timestamptz not null default now()
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  amount numeric(12,2) not null,
  kind transaction_kind not null,
  category text not null,
  animal_id integer references animals(id),
  customer_id uuid references contacts(id),
  vendor_id uuid references contacts(id),
  notes text,
  source_row integer,
  purchase_agreement_id uuid,
  livestock_sale_id uuid,
  created_at timestamptz not null default now()
);

create table purchase_agreements (
  id uuid primary key default gen_random_uuid(),
  animal_id integer not null references animals(id) on delete cascade,
  vendor_id uuid references contacts(id),
  total_amount numeric(12,2) not null,
  amount_paid numeric(12,2) not null default 0,
  status agreement_status not null default 'open',
  notes text,
  created_at timestamptz not null default now()
);

alter table transactions
  add constraint transactions_purchase_agreement_id_fkey
  foreign key (purchase_agreement_id) references purchase_agreements(id) on delete set null;

create table livestock_sales (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  animal_ids integer[] not null default '{}',
  gross_sale_price numeric(12,2) not null,
  delivery_cost numeric(12,2) not null default 0,
  net_received numeric(12,2) not null,
  amount_received numeric(12,2) not null default 0,
  status agreement_status not null default 'open',
  customer_id uuid references contacts(id),
  notes text,
  created_at timestamptz not null default now()
);

alter table transactions
  add constraint transactions_livestock_sale_id_fkey
  foreign key (livestock_sale_id) references livestock_sales(id) on delete set null;

create table medical_events (
  id uuid primary key default gen_random_uuid(),
  animal_id integer not null references animals(id) on delete cascade,
  event_type medical_event_type not null,
  date date,
  notes text,
  comment text,
  transaction_id uuid references transactions(id),
  created_at timestamptz not null default now()
);

create table breeding_events (
  id uuid primary key default gen_random_uuid(),
  female_animal_id integer not null references animals(id),
  male_animal_id integer references animals(id),
  buck_name text,
  date_crossed date,
  expected_due_date date,
  delivered_date date,
  ultrasound_date date,
  fetus_count integer,
  outcome breeding_outcome default 'Pending',
  status breeding_status,
  notes text,
  created_at timestamptz not null default now()
);

create table weight_logs (
  id uuid primary key default gen_random_uuid(),
  animal_id integer not null references animals(id) on delete cascade,
  weighed_on date not null,
  weight_kg numeric(8,2) not null,
  notes text,
  created_at timestamptz not null default now()
);

create table animal_media (
  id uuid primary key default gen_random_uuid(),
  animal_id integer not null references animals(id) on delete cascade,
  storage_path text not null,
  media_type media_type not null,
  caption text,
  created_at timestamptz not null default now()
);

create table app_meta (
  id integer primary key default 1 check (id = 1),
  imported_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into app_meta (id) values (1) on conflict (id) do nothing;

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role user_role not null default 'guest',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_transactions_date on transactions(date);
create index idx_transactions_category on transactions(category);
create index idx_animals_status on animals(status);
create index idx_animals_owner on animals(owner_id);
create index idx_animals_dam on animals(dam_id);
create index idx_animals_sire on animals(sire_id);
create index idx_livestock_sales_date on livestock_sales(date);
create index idx_animal_media_animal on animal_media(animal_id);
create index idx_purchase_agreements_animal on purchase_agreements(animal_id);
create index idx_transactions_purchase_agreement on transactions(purchase_agreement_id);
create index idx_transactions_livestock_sale on transactions(livestock_sale_id);
create index idx_medical_events_animal on medical_events(animal_id);
create index idx_medical_events_date on medical_events(date);

-- RLS: authenticated users have full access (single-tenant v1)
alter table contacts enable row level security;
alter table animals enable row level security;
alter table transactions enable row level security;
alter table medical_events enable row level security;
alter table breeding_events enable row level security;
alter table weight_logs enable row level security;
alter table livestock_sales enable row level security;
alter table animal_media enable row level security;
alter table app_meta enable row level security;
alter table purchase_agreements enable row level security;
alter table profiles enable row level security;

create policy "authenticated_all_contacts" on contacts for all to authenticated using (true) with check (true);
create policy "authenticated_all_animals" on animals for all to authenticated using (true) with check (true);
create policy "authenticated_all_transactions" on transactions for all to authenticated using (true) with check (true);
create policy "authenticated_all_medical" on medical_events for all to authenticated using (true) with check (true);
create policy "authenticated_all_breeding" on breeding_events for all to authenticated using (true) with check (true);
create policy "authenticated_all_weights" on weight_logs for all to authenticated using (true) with check (true);
create policy "authenticated_all_livestock_sales" on livestock_sales for all to authenticated using (true) with check (true);
create policy "authenticated_all_animal_media" on animal_media for all to authenticated using (true) with check (true);
create policy "authenticated_all_app_meta" on app_meta for all to authenticated using (true) with check (true);
create policy "authenticated_all_purchase_agreements" on purchase_agreements for all to authenticated using (true) with check (true);

create policy "users_read_own_profile"
  on profiles for select
  to authenticated
  using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'guest'::user_role)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'animal-media',
  'animal-media',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "authenticated_read_animal_media"
  on storage.objects for select to authenticated
  using (bucket_id = 'animal-media');

create policy "authenticated_upload_animal_media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'animal-media');

create policy "authenticated_update_animal_media"
  on storage.objects for update to authenticated
  using (bucket_id = 'animal-media')
  with check (bucket_id = 'animal-media');

create policy "authenticated_delete_animal_media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'animal-media');
