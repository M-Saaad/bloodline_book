-- Phase 8: gestation setting and due windows on breedings.

alter table farms
  add column if not exists gestation_days integer not null default 150;

alter table breeding_events
  add column if not exists exposure_end_date date,
  add column if not exists due_window_start date,
  add column if not exists due_window_end date,
  add column if not exists confirmed_date date,
  add column if not exists confirm_method text;

alter table breeding_events drop constraint if exists breeding_events_status_check;
alter table breeding_events add constraint breeding_events_status_check
  check (status in ('bred', 'confirmed', 'open', 'kidded', 'dry', 'lost'));

alter table breeding_events drop constraint if exists breeding_events_confirm_method_check;
alter table breeding_events add constraint breeding_events_confirm_method_check
  check (
    confirm_method is null
    or confirm_method in ('ultrasound', 'blood_test', 'other')
  );

update breeding_events
set due_window_start = due_date - 5,
    due_window_end = due_date + 5
where due_date is not null
  and due_window_start is null;
