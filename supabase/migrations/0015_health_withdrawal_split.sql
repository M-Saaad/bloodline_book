-- Phase 10: meat and milk withdrawal, route, lot, FAMACHA recheck interval.

alter table farms
  add column if not exists famacha_recheck_days integer not null default 14;

alter table health_records
  add column if not exists meat_withdrawal_days integer,
  add column if not exists milk_withdrawal_days integer,
  add column if not exists route text,
  add column if not exists lot_number text;

alter table health_records drop constraint if exists health_records_meat_withdrawal_days_check;
alter table health_records add constraint health_records_meat_withdrawal_days_check
  check (meat_withdrawal_days is null or meat_withdrawal_days >= 0);

alter table health_records drop constraint if exists health_records_milk_withdrawal_days_check;
alter table health_records add constraint health_records_milk_withdrawal_days_check
  check (milk_withdrawal_days is null or milk_withdrawal_days >= 0);

alter table health_records drop constraint if exists health_records_route_check;
alter table health_records add constraint health_records_route_check
  check (
    route is null
    or route in ('oral', 'sc', 'im', 'topical', 'other')
  );

update health_records
set meat_withdrawal_days = withdrawal_days,
    milk_withdrawal_days = withdrawal_days
where withdrawal_days is not null
  and meat_withdrawal_days is null
  and milk_withdrawal_days is null;

alter table tasks drop constraint if exists tasks_source_check;
alter table tasks add constraint tasks_source_check
  check (
    source in (
      'manual',
      'health',
      'breeding',
      'weaning',
      'weigh_day',
      'famacha_check',
      'meat_withdrawal',
      'milk_withdrawal',
      'deworm'
    )
  );
