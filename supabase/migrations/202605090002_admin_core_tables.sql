-- Admin platform tables + public read for service unit catalog.
-- Passwords in seed rows are plaintext for initial bootstrap; rotate in production
-- (hashing can be added via pgcrypto + edge verify without changing column names).

-- ---------------------------------------------------------------------------
-- Service units & sub-units (IDs align with src/data.js SERVICE_UNITS)
-- ---------------------------------------------------------------------------
create table if not exists public.service_units (
  id bigint primary key,
  name text not null,
  description text not null default '',
  coordinator text not null default '',
  sort_order int not null default 0,
  is_active smallint not null default 1
);

create table if not exists public.sub_units (
  id bigserial primary key,
  unit_id bigint not null references public.service_units (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_active smallint not null default 1,
  unique (unit_id, name)
);

create index if not exists idx_sub_units_unit_id on public.sub_units (unit_id);

-- ---------------------------------------------------------------------------
-- Admins (username/password auth for edge functions; not Supabase Auth users)
-- ---------------------------------------------------------------------------
create table if not exists public.admins (
  id bigserial primary key,
  full_name text not null,
  username text not null,
  email text not null,
  password text not null,
  role text not null check (role in (
    'super_admin',
    'general_admin',
    'country_super_admin',
    'state_super_admin',
    'service_unit_leader',
    'sub_unit_leader'
  )),
  service_unit_id bigint references public.service_units (id) on delete set null,
  sub_unit_name text not null default '',
  branch_country text not null default '',
  branch_state text not null default '',
  is_active smallint not null default 1,
  last_login timestamptz
);

create unique index if not exists idx_admins_username_lower on public.admins (lower(username));
create unique index if not exists idx_admins_email_lower on public.admins (lower(email));

-- ---------------------------------------------------------------------------
-- Activity log & support requests & app settings
-- ---------------------------------------------------------------------------
create table if not exists public.activity_logs (
  id bigserial primary key,
  admin_id bigint references public.admins (id) on delete set null,
  admin_name text not null,
  action text not null,
  entity_type text not null default '',
  entity_id text not null default '',
  description text not null default '',
  ip_address text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_logs_created_at on public.activity_logs (created_at desc);

create table if not exists public.admin_requests (
  id bigserial primary key,
  from_admin_id bigint not null references public.admins (id) on delete cascade,
  from_name text not null,
  from_role text not null,
  message text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_requests_created_at on public.admin_requests (created_at desc);

create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  templates jsonb not null default '{}'::jsonb,
  overdue_threshold_hours int not null default 72,
  permissions jsonb not null default '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.service_units enable row level security;
alter table public.sub_units enable row level security;
alter table public.admins enable row level security;
alter table public.activity_logs enable row level security;
alter table public.admin_requests enable row level security;
alter table public.app_settings enable row level security;
alter table public.registrations enable row level security;

-- Public form: read active catalog only
drop policy if exists "anon_read_service_units" on public.service_units;
create policy "anon_read_service_units"
  on public.service_units for select
  using (is_active = 1);

drop policy if exists "anon_read_sub_units" on public.sub_units;
create policy "anon_read_sub_units"
  on public.sub_units for select
  using (is_active = 1);

-- No direct client access to admin tables or registrations (edge uses service role)

grant select on public.service_units to anon, authenticated;
grant select on public.sub_units to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Seed: service units (matches src/data.js)
-- ---------------------------------------------------------------------------
insert into public.service_units (id, name, description, coordinator, sort_order, is_active) values
  (1, 'Choir', '', '', 0, 1),
  (2, 'Special Care Unit', '', '', 1, 1),
  (3, 'Medical Team', '', '', 2, 1),
  (4, 'Peacekeepers Unit', '', '', 3, 1),
  (5, 'Safety Unit', '', '', 4, 1),
  (6, 'Sanctuary Keepers', '', '', 5, 1),
  (7, 'Children Ministry', '', '', 6, 1),
  (8, 'Decoration Unit', '', '', 7, 1),
  (9, 'Editorial Unit', '', '', 8, 1),
  (10, 'Crowd Management Unit (CC1)', '', '', 9, 1),
  (11, 'Soul Establishment Unit', '', '', 10, 1),
  (12, 'Media & Service', '', '', 11, 1),
  (13, 'Ushering Unit', '', '', 12, 1),
  (14, 'Foreign Language Unit', '', '', 13, 1),
  (15, 'Horticulture', '', '', 14, 1)
on conflict (id) do update set
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

-- Sub-units (names only; IDs are generated)
insert into public.sub_units (unit_id, name, sort_order, is_active)
select * from (values
  (7, 'Lessons & teaching', 0, 1),
  (7, 'Activities & programs', 1, 1),
  (7, 'Children''s worship', 2, 1),
  (7, 'Environment / classroom setup', 3, 1),
  (8, 'Sanctuary décor & altar aesthetics', 0, 1),
  (8, 'Altar cleanliness & hygiene', 1, 1),
  (9, 'Testimonies & life stories', 0, 1),
  (9, 'Magazines & editorial publications', 1, 1),
  (10, 'Entry / exit & flow', 0, 1),
  (10, 'Seating coordination', 1, 1),
  (10, 'Crowd control & queue management', 2, 1),
  (11, 'Service unit placement & follow-up', 0, 1),
  (11, 'Cell fellowship integration', 1, 1),
  (12, 'Audio', 0, 1),
  (12, 'Video', 1, 1),
  (12, 'Electrical', 2, 1),
  (13, 'Seating & order', 0, 1),
  (13, 'Offerings & collection support', 1, 1),
  (13, 'Visitors & new converts hospitality', 2, 1),
  (14, 'Live interpretation (services)', 0, 1),
  (14, 'Written materials translation', 1, 1),
  (15, 'Cultivation & grounds care', 0, 1),
  (15, 'Landscape design', 1, 1),
  (15, 'Garden / grounds maintenance', 2, 1)
) as v(unit_id, name, sort_order, is_active)
where not exists (
  select 1 from public.sub_units s
  where s.unit_id = v.unit_id and s.name = v.name
);

-- ---------------------------------------------------------------------------
-- Seed admins (passwords match prior local demo; change after deploy)
-- Media & Service = unit id 12
-- ---------------------------------------------------------------------------
insert into public.admins (id, full_name, username, email, password, role, service_unit_id, sub_unit_name, branch_country, branch_state, is_active)
select * from (values
  (1::bigint, 'Super Admin'::text, 'superadmin'::text, 'superadmin@smhos.org'::text, 'Admin@1234'::text, 'super_admin'::text, null::bigint, ''::text, ''::text, ''::text, 1::smallint),
  (2, 'Chuks', 'chuks', 'chuks@smhos.org', 'Ibiyeomie@58', 'service_unit_leader', 12, '', '', '', 1),
  (3, 'Inatimi', 'inatimi', 'inatimi@smhos.org', 'Ibiyeomie@58', 'sub_unit_leader', 12, 'Audio', '', '', 1),
  (4, 'Nigeria Country Super Admin', 'country.admin', 'country.admin@smhos.org', 'Ibiyeomie@58', 'country_super_admin', null, '', 'NG', '', 1),
  (5, 'Rivers State Super Admin', 'rivers.state', 'rivers.state@smhos.org', 'Ibiyeomie@58', 'state_super_admin', null, '', 'NG', 'RI', 1)
) as v(id, full_name, username, email, password, role, service_unit_id, sub_unit_name, branch_country, branch_state, is_active)
where not exists (select 1 from public.admins a where a.id = v.id);

select setval(
  pg_get_serial_sequence('public.admins', 'id'),
  (select coalesce(max(id), 1) from public.admins)
);

insert into public.app_settings (id, templates, overdue_threshold_hours, permissions)
select
  1,
  '{"approved": "Hello {{name}}, your registration has been approved.", "rejected": "Hello {{name}}, your registration was not approved.", "waitlisted": "Hello {{name}}, your registration is currently waitlisted."}'::jsonb,
  72,
  '{"leaders_can_update_queue": true, "leaders_can_send_requests": true, "sub_unit_leaders_can_update_queue": true}'::jsonb
where not exists (select 1 from public.app_settings where id = 1);
