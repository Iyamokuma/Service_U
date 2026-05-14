create table if not exists public.announcements (
  id bigserial primary key,
  title text not null,
  body text not null,
  branch_country text not null default '',
  scope_unit_id bigint references public.service_units (id) on delete set null,
  scope_sub_unit text not null default '',
  scope_branch_state text not null default '',
  scope_satellite_site text not null default '',
  created_by_admin_id bigint references public.admins (id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_announcements_created_at on public.announcements (created_at desc);
create index if not exists idx_announcements_country on public.announcements (branch_country);

alter table public.announcements enable row level security;
