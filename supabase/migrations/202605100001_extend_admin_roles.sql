-- Add Data Entry Admin + Satellite Church Admin; optional satellite label on admins.

alter table public.admins add column if not exists satellite_site text not null default '';

-- Inline CHECK on `role` is typically named admins_role_check in PostgreSQL.
alter table public.admins drop constraint if exists admins_role_check;

alter table public.admins add constraint admins_role_check check (role in (
  'super_admin',
  'general_admin',
  'data_entry_admin',
  'country_super_admin',
  'state_super_admin',
  'satellite_church_admin',
  'service_unit_leader',
  'sub_unit_leader'
));
