-- Phase 9: kidding ease and farm weaning age.

alter table kidding_events
  add column if not exists kidding_ease text;

alter table kidding_events drop constraint if exists kidding_events_kidding_ease_check;
alter table kidding_events add constraint kidding_events_kidding_ease_check
  check (
    kidding_ease is null
    or kidding_ease in ('unassisted', 'assisted', 'vet')
  );

alter table farms
  add column if not exists weaning_days integer default 90;
