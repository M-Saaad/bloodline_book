-- Farm display name for home header

alter table farm_settings
  add column if not exists farm_name text default 'Sunridge Dairy Goats';

update farm_settings set farm_name = 'Sunridge Dairy Goats' where farm_name is null;
