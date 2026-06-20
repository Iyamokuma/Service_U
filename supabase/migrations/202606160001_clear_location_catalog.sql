-- Wipe location catalog so fresh countries / states / branches / churches / satellites can be imported.
-- Does NOT touch admins, registrations, or announcements (they may still reference old branch strings).

delete from public.churches;

delete from public.satellite_church_sites;

delete from public.directory_branches;
delete from public.directory_states;
delete from public.directory_countries;

delete from public.admin_requests
where request_type = 'location_catalog';

-- Reset auto-increment ids for tables that use serial/bigserial.
alter sequence if exists public.churches_id_seq restart with 1;
alter sequence if exists public.satellite_church_sites_id_seq restart with 1;
