-- Phase 3: US breeder identity fields and free-text breeds

alter table animals
  add column if not exists registered_name text,
  add column if not exists barn_name text,
  add column if not exists previous_name text,
  add column if not exists adga_registration_number text,
  add column if not exists tattoo_right text,
  add column if not exists tattoo_left text,
  add column if not exists tattoo_tail_web text,
  add column if not exists eid_microchip text,
  add column if not exists scrapie_tag text,
  add column if not exists farm_tag text;

-- Replace Pakistan breed enum with free text
alter table animals alter column breed type text using breed::text;
drop type if exists animal_breed;

create index idx_animals_adga on animals(adga_registration_number) where adga_registration_number is not null;
create index idx_animals_farm_tag on animals(farm_tag) where farm_tag is not null;
