-- Critical threshold (days overdue before "critical") + leader notification queue for batched digests.

alter table public.app_settings
  add column if not exists critical_threshold_days int not null default 30;

alter table public.app_settings
  drop constraint if exists app_settings_critical_threshold_days_check;

alter table public.app_settings
  add constraint app_settings_critical_threshold_days_check
  check (critical_threshold_days >= 1 and critical_threshold_days <= 90);

update public.app_settings
set critical_threshold_days = 30
where id = 1 and critical_threshold_days is null;

alter table public.overdue_escalation
  add column if not exists critical_notified_at timestamptz;

-- Pending new-registration digests for sub-unit leaders (batched email).
create table if not exists public.registration_notify_queue (
  id bigserial primary key,
  registration_id uuid not null references public.registrations (id) on delete cascade,
  admin_id bigint not null references public.admins (id) on delete cascade,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  unique (registration_id, admin_id)
);

create index if not exists idx_registration_notify_queue_pending
  on public.registration_notify_queue (admin_id, notified_at)
  where notified_at is null;

alter table public.registration_notify_queue enable row level security;
