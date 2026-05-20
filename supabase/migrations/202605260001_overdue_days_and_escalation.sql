-- Overdue threshold in days (1–30), optional per service unit; escalation tracking.

alter table public.app_settings
  add column if not exists overdue_threshold_days int not null default 3;

update public.app_settings
set overdue_threshold_days = greatest(
  1,
  least(30, coalesce(nullif(ceil(overdue_threshold_hours / 24.0)::int, 0), 3))
)
where id = 1;

alter table public.service_units
  add column if not exists overdue_threshold_days int;

alter table public.service_units
  drop constraint if exists service_units_overdue_threshold_days_check;

alter table public.service_units
  add constraint service_units_overdue_threshold_days_check
  check (
    overdue_threshold_days is null
    or (overdue_threshold_days >= 1 and overdue_threshold_days <= 30)
  );

create table if not exists public.overdue_escalation (
  registration_id uuid primary key references public.registrations (id) on delete cascade,
  threshold_crossed_at timestamptz not null default now(),
  sub_notified_at timestamptz,
  unit_escalated_at timestamptz,
  satellite_escalated_at timestamptz
);

create index if not exists idx_overdue_escalation_crossed on public.overdue_escalation (threshold_crossed_at);

alter table public.overdue_escalation enable row level security;
