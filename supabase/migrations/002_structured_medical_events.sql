-- Phase 1: structured health data for US dairy goat breeders

alter type medical_event_type add value if not exists 'FAMACHA';
alter type medical_event_type add value if not exists 'FecalEggCount';
alter type medical_event_type add value if not exists 'BodyConditionScore';

alter table medical_events
  add column if not exists product_brand text,
  add column if not exists active_ingredient text,
  add column if not exists drug_class text,
  add column if not exists route text,
  add column if not exists dose_amount numeric,
  add column if not exists dose_unit text,
  add column if not exists withdrawal_meat_days integer,
  add column if not exists withdrawal_milk_days integer,
  add column if not exists withdrawal_clear_date date,
  add column if not exists lot_number text,
  add column if not exists expiration_date date,
  add column if not exists famacha_score integer check (famacha_score is null or famacha_score between 1 and 5),
  add column if not exists body_condition_score numeric check (
    body_condition_score is null or (
      body_condition_score >= 1
      and body_condition_score <= 5
      and (body_condition_score * 2) = floor(body_condition_score * 2)
    )
  ),
  add column if not exists fecal_egg_count integer check (fecal_egg_count is null or fecal_egg_count >= 0),
  add column if not exists fec_reduction_pct numeric check (
    fec_reduction_pct is null or (fec_reduction_pct >= 0 and fec_reduction_pct <= 100)
  ),
  add column if not exists prior_treatment_event_id uuid references medical_events(id) on delete set null,
  add column if not exists production_stage text;

comment on column medical_events.product_brand is 'Commercial product name (e.g. Bar-Vac CD/T)';
comment on column medical_events.active_ingredient is 'Active ingredient when known';
comment on column medical_events.route is 'oral drench, injectable, topical, feed, intranasal';
comment on column medical_events.dose_amount is 'Actual dose administered — never auto-calculated';
comment on column medical_events.withdrawal_clear_date is 'Computed on save from event date + max(meat, milk) withdrawal days';
