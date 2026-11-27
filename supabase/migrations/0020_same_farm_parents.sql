-- Same-farm parents for kidding and pedigree.
-- Additive. Does not update or delete existing rows.
-- Not applied by the app. Review this file, then run it in the Supabase SQL editor.
-- The next insert or update of a row whose dam or sire is on another farm fails
-- until that row is corrected. A kidding_events row that already points at another
-- farm's doe will fail on its next update.

create or replace function public.assert_referenced_animal_same_farm(
  parent_id uuid,
  child_farm_id uuid,
  role_label text
) returns void
language plpgsql
set search_path = public
as $$
declare
  parent_farm uuid;
begin
  if parent_id is null then
    return;
  end if;

  select farm_id into parent_farm
  from public.animals
  where id = parent_id;

  if parent_farm is null or parent_farm is distinct from child_farm_id then
    raise exception '% must be a goat on the same farm', role_label
      using errcode = '23514';
  end if;
end;
$$;

create or replace function public.kidding_events_same_farm_parents()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.assert_referenced_animal_same_farm(new.dam_id, new.farm_id, 'Kidding dam');
  perform public.assert_referenced_animal_same_farm(new.sire_id, new.farm_id, 'Kidding sire');
  return new;
end;
$$;

create or replace function public.animals_same_farm_parents()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.assert_referenced_animal_same_farm(new.dam_id, new.farm_id, 'Dam');
  perform public.assert_referenced_animal_same_farm(new.sire_id, new.farm_id, 'Sire');
  return new;
end;
$$;

create or replace function public.breeding_events_same_farm_parents()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.assert_referenced_animal_same_farm(new.dam_id, new.farm_id, 'Breeding dam');
  perform public.assert_referenced_animal_same_farm(new.sire_id, new.farm_id, 'Breeding sire');
  return new;
end;
$$;

drop trigger if exists kidding_events_same_farm_parents on public.kidding_events;
create trigger kidding_events_same_farm_parents
  before insert or update on public.kidding_events
  for each row
  execute function public.kidding_events_same_farm_parents();

drop trigger if exists animals_same_farm_parents on public.animals;
create trigger animals_same_farm_parents
  before insert or update on public.animals
  for each row
  execute function public.animals_same_farm_parents();

drop trigger if exists breeding_events_same_farm_parents on public.breeding_events;
create trigger breeding_events_same_farm_parents
  before insert or update on public.breeding_events
  for each row
  execute function public.breeding_events_same_farm_parents();
