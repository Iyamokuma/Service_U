-- In-app notifications (e.g. overdue applications for unit / sub-unit leaders).
create table if not exists public.admin_notifications (
  id bigserial primary key,
  admin_id bigint not null references public.admins (id) on delete cascade,
  type text not null default 'overdue_application',
  title text not null,
  body text not null,
  entity_type text not null default '',
  entity_id text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_admin_notifications_admin_created on public.admin_notifications (admin_id, created_at desc);

-- One overdue alert per registration per leader until the registration leaves the open pipeline.
create table if not exists public.overdue_notify_dedup (
  registration_id text not null,
  admin_id bigint not null references public.admins (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (registration_id, admin_id)
);

alter table public.admin_notifications enable row level security;
alter table public.overdue_notify_dedup enable row level security;
