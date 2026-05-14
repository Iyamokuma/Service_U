-- Sub-unit leader acceptance attestations (stored on registration row).
alter table public.registrations add column if not exists leader_accept_foundation_class boolean not null default false;
alter table public.registrations add column if not exists leader_accept_water_baptism boolean not null default false;
alter table public.registrations add column if not exists leader_accept_wolbi boolean not null default false;
alter table public.registrations add column if not exists leader_accept_wolbi_level text not null default '';
alter table public.registrations add column if not exists leader_accept_called_candidate boolean not null default false;
alter table public.registrations add column if not exists leader_accept_physical_meeting boolean not null default false;
alter table public.registrations add column if not exists leader_accept_verified_at timestamptz;

-- Announcements: optional service unit / sub-unit scope (for leaders).
alter table public.announcements add column if not exists scope_unit_id bigint references public.service_units (id) on delete set null;
alter table public.announcements add column if not exists scope_sub_unit text not null default '';
