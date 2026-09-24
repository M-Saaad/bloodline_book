-- Phase 6: updated_at on editable tables for sync conflict handling.

alter table health_records
  add column if not exists updated_at timestamptz not null default now();

alter table transactions
  add column if not exists updated_at timestamptz not null default now();

alter table weigh_sessions
  add column if not exists updated_at timestamptz not null default now();

alter table weight_logs
  add column if not exists updated_at timestamptz not null default now();

alter table feed_logs
  add column if not exists updated_at timestamptz not null default now();

alter table grazing_records
  add column if not exists updated_at timestamptz not null default now();

alter table tasks
  add column if not exists updated_at timestamptz not null default now();

alter table documents
  add column if not exists updated_at timestamptz not null default now();
