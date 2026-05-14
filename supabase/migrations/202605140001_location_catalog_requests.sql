-- Structured location proposals from data entry (super/general approve before sites go live).
alter table public.admin_requests add column if not exists request_type text not null default 'general';
alter table public.admin_requests add column if not exists payload jsonb not null default '{}'::jsonb;

create table if not exists public.satellite_church_sites (
  id bigserial primary key,
  continent text not null default '',
  branch_country text not null,
  branch_state text not null,
  lga text not null default '',
  site_name text not null,
  source_request_id bigint references public.admin_requests (id) on delete set null,
  is_active int not null default 1,
  created_at timestamptz not null default now(),
  unique (branch_country, branch_state, lga, site_name)
);

create index if not exists idx_satellite_sites_branch on public.satellite_church_sites (branch_country, branch_state);
create index if not exists idx_satellite_sites_active on public.satellite_church_sites (is_active);

alter table public.satellite_church_sites enable row level security;
