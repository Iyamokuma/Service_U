-- Stable codes on directory tables for admin-managed catalog + public form.
alter table public.directory_countries add column if not exists branch_country_code text;
alter table public.directory_states add column if not exists branch_state_code text;

update public.directory_countries c set branch_country_code = v.code
from (values
  (1, 'NG'), (2, 'ASIA'), (3, 'BJ'), (4, 'CM'), (5, 'GM'),
  (6, 'GH'), (7, 'CH'), (8, 'AE'), (9, 'GB'), (10, 'US')
) as v(id, code) where c.id = v.id;

-- Prefer live churches.branch_state per directory state (one pick if multiple churches disagree).
update public.directory_states ds
set branch_state_code = upper(trim(x.branch_state))
from (
  select distinct on (db.state_id) db.state_id, ch.branch_state
  from public.directory_branches db
  join public.churches ch on ch.directory_branch_id = db.id and ch.is_active = 1
  order by db.state_id, ch.branch_state
) x
where ds.id = x.state_id
  and (ds.branch_state_code is null or trim(ds.branch_state_code) = '');

-- Nigeria states not linked to any church yet (match by canonical codes).
update public.directory_states set branch_state_code = case id
  when 1 then 'RI' when 2 then 'ABI' when 3 then 'AKB' when 4 then 'ANA' when 5 then 'ADM'
  when 6 then 'BAU' when 7 then 'BAY' when 8 then 'BEN' when 9 then 'BOR' when 10 then 'CRV'
  when 11 then 'DE' when 12 then 'EBY' when 13 then 'EDO' when 14 then 'EKI' when 15 then 'ENU'
  when 16 then 'FCT' when 17 then 'GOM' when 18 then 'IMO' when 19 then 'JIG' when 20 then 'KAD'
  when 21 then 'KAN' when 22 then 'KAT' when 23 then 'KEB' when 24 then 'KOG' when 25 then 'KWA'
  when 26 then 'LA' when 27 then 'NAS' when 28 then 'NIE' when 29 then 'OGU' when 30 then 'OND'
  when 31 then 'OSU' when 32 then 'OYO' when 33 then 'PLA' when 34 then 'SOK' when 35 then 'TAR'
  when 36 then 'YOB' when 37 then 'ZAM'
end
where country_id = 1 and (branch_state_code is null or trim(branch_state_code) = '');

-- Other countries: single region row → use country code as state code when still empty.
update public.directory_states ds
set branch_state_code = upper(trim(dc.branch_country_code))
from public.directory_countries dc
where ds.country_id = dc.id
  and dc.id not in (1)
  and (ds.branch_state_code is null or trim(ds.branch_state_code) = '')
  and dc.branch_country_code is not null;

create unique index if not exists directory_countries_branch_country_code_uidx
  on public.directory_countries (branch_country_code)
  where branch_country_code is not null and trim(branch_country_code) <> '';

create unique index if not exists directory_states_country_branch_state_uidx
  on public.directory_states (country_id, branch_state_code)
  where branch_state_code is not null and trim(branch_state_code) <> '';
