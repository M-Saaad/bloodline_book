-- Outside dams (bought goats, AI, other farms) without adding them to the active herd.

alter table animals add column if not exists dam_external_name text;
