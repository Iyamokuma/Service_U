-- Split United States and Canada in the location directory.
-- US: country code US with exactly Alabama, Maryland, Pennsylvania, Texas.
-- Canada: separate country code CA with Ontario (Mississauga church).

update public.directory_countries
set name = 'United States'
where branch_country_code = 'US';

update public.directory_countries
set name = 'Canada'
where branch_country_code = 'CA';

update public.directory_states ds
set name = case ds.branch_state_code
  when 'AL' then 'Alabama'
  when 'MD' then 'Maryland'
  when 'PA' then 'Pennsylvania'
  when 'TX' then 'Texas'
  when 'ON' then 'Ontario'
  else ds.name
end
from public.directory_countries dc
where dc.id = ds.country_id
  and dc.branch_country_code in ('US', 'CA');

-- Remove any stray US states outside the four allowed codes (and their branches/churches).
do $$
declare
  us_id integer;
  stray record;
begin
  select id into us_id from public.directory_countries where branch_country_code = 'US' limit 1;
  if us_id is null then return; end if;

  for stray in
    select ds.id, ds.branch_state_code
    from public.directory_states ds
    where ds.country_id = us_id
      and ds.branch_state_code not in ('AL', 'MD', 'PA', 'TX')
  loop
    delete from public.churches where branch_country = 'US' and branch_state = stray.branch_state_code;
    delete from public.satellite_church_sites where branch_country = 'US' and branch_state = stray.branch_state_code;
    delete from public.directory_branches where state_id = stray.id;
    delete from public.directory_states where id = stray.id;
  end loop;
end $$;

update public.satellite_church_sites
set continent = 'North America'
where branch_country in ('US', 'CA');
