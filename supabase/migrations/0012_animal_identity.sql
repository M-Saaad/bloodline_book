-- Phase 7: official scrapie / USDA ID and tag lookup index.

alter table animals add column if not exists official_id text;

create index if not exists idx_animals_farm_tag on animals(farm_id, tag_number);
