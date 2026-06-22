-- Replace all Delta State (Nigeria / DE) churches with corrected catalog from
-- supabase/seeds/delta_state_churches.csv (50 branches).

DO $$
DECLARE
  delta_state_id integer;
  ng_country_id integer;
BEGIN
  SELECT dc.id INTO ng_country_id
  FROM public.directory_countries dc
  WHERE upper(trim(dc.branch_country_code)) = 'NG'
  LIMIT 1;

  IF ng_country_id IS NULL THEN
    RAISE EXCEPTION 'reload_delta_state: Nigeria (NG) not found in directory_countries';
  END IF;

  SELECT ds.id INTO delta_state_id
  FROM public.directory_states ds
  WHERE ds.country_id = ng_country_id
    AND upper(trim(ds.branch_state_code)) = 'DE'
  LIMIT 1;

  IF delta_state_id IS NULL THEN
    RAISE EXCEPTION 'reload_delta_state: Delta (DE) not found in directory_states';
  END IF;

  -- Remove existing Delta branches (codes DE or full name Delta).
  DELETE FROM public.churches ch
  WHERE upper(trim(ch.branch_country)) = 'NG'
    AND (
      upper(trim(ch.branch_state)) = 'DE'
      OR upper(trim(ch.branch_state)) = 'DELTA'
    );

  DELETE FROM public.satellite_church_sites sat
  WHERE upper(trim(sat.branch_country)) = 'NG'
    AND (
      upper(trim(sat.branch_state)) = 'DE'
      OR upper(trim(sat.branch_state)) = 'DELTA'
    );

  DELETE FROM public.directory_branches db
  WHERE db.state_id = delta_state_id;
END $$;

-- Re-insert directory branches (ids 625–674).
DO $$
DECLARE
  delta_state_id integer;
BEGIN
  SELECT ds.id INTO delta_state_id
  FROM public.directory_states ds
  JOIN public.directory_countries dc ON dc.id = ds.country_id
  WHERE upper(trim(dc.branch_country_code)) = 'NG'
    AND upper(trim(ds.branch_state_code)) = 'DE'
  LIMIT 1;

  INSERT INTO public.directory_branches (id, state_id, name, address) VALUES
  (625, delta_state_id, 'AIRPORT RD', 'DANDANI EVENT, CENTER #128, AIRPORT ROAD'),
  (626, delta_state_id, 'AJAMIMOGHA', '#55 AJAMIMOGHA RD, WARRI'),
  (627, delta_state_id, 'AGBARHO', '#6 EWHERHE RD BY MODERN PRY SCH'),
  (628, delta_state_id, 'AGBARHO OTOR', '#6 OKOSE STREET, OFF, AGBARHA/EMEVO, RD, AGBARHA-OTOR'),
  (629, delta_state_id, 'ABRAKA 1', 'FORMER DOUBLE, DELIGHT FAST FOOD BY FSP JUNCTION'),
  (630, delta_state_id, 'ABRAKA 2', '#204 OLD, ABRAKA/AGBOR RD, BESIDES WIMA, CLINIC, OKORHIRHE'),
  (631, delta_state_id, 'AMEKPE (UGHELLI3)', 'EDAFE EVENT, CENTER, END OF, OCHUKO LANE, 1ST, AMEKPE'),
  (632, delta_state_id, 'BOMADI', 'ORDELE EVENTS, HALL, GRA BOMADI, OPP LG CHAIRMAN'),
  (633, delta_state_id, 'ENERHEN HQ', '#11 WARRI/SAPELE RD, BY ENERHEN, JUNC'),
  (634, delta_state_id, 'ENHWE', 'EFE-OMOVUDU, EVENT CENTER, BESIDES ULEWE, QUARTER'),
  (635, delta_state_id, 'EKPAN', '#3 NIGER CAT LINK, RD, OFF REFINERY, RD, AND NEPA, EXPRESSWAY, BEHIND CHICKEN REP'),
  (636, delta_state_id, 'EKU', 'OLD AGBOR, SAPELE RD, BY STAFF, QUARTERS, OPP, SULEMAN POULTRY, EKU'),
  (637, delta_state_id, 'EMEVOR', '#6 OKOSE STREET, OFF, AGBARHA/EMEVO, ROAD'),
  (638, delta_state_id, 'IRRI', '#39 MISSIONS ROAD'),
  (639, delta_state_id, 'JAKPA', '#2 EDU STREET, OFF JAKPA ROAD'),
  (640, delta_state_id, 'JIBALE', 'FORMER JITOS, HOTEL OPP JIBALE, MKT, ORUWHORUN'),
  (641, delta_state_id, 'KWALE', 'ADEGE STREET, BESIDES BENVO, TWINS HOTEL OFF, ASABA EXPRESS RD'),
  (642, delta_state_id, 'OBIAROKO', 'EDEM ONAH EVENT CENTER ALONG, ABRAKA/OBIARUKU EXPRESS ROAD'),
  (643, delta_state_id, 'OTOR UDU', 'EVWOR QUARTERS, HALL'),
  (644, delta_state_id, 'MOFOR', '#191 DSC EXPRESS, WAY OPP EKETE, INLAND JUNCTION'),
  (645, delta_state_id, 'OLEH', '#3 NEW EMEDE RD, BY YANGA MKT, OLEH'),
  (646, delta_state_id, 'OLOMORO', ''),
  (647, delta_state_id, 'OZORO', 'PARADISE HOTEL, BEHIND ZOUKUMOR PRIMARY SCHOOL'),
  (648, delta_state_id, 'OWHELOGBO', '#86 HOSPITAL RD'),
  (649, delta_state_id, 'PATANI', 'LOCAL, GOVERNMENT, COUNCIL, CONFERENCE HALL, EKISE PATANI.'),
  (650, delta_state_id, 'SAPELE 1', 'COMM RD, OPP, OKIRIGWHE, COMM HALL, , SAPELE'),
  (651, delta_state_id, 'SAPELE 2', '#1 EWETA LANE OPP PJ GOLDEN HOTEL, GANA'),
  (652, delta_state_id, 'ABRAKA 3', 'POLICE STATION RD, BY LUCAS JUNCTION'),
  (653, delta_state_id, 'UGHELLI 1', '#1 ERUOBOGA STR, BESIDE TOTAL CHILD SCH, AKPODIETE'),
  (654, delta_state_id, 'UGHELLI 2', '#120 ISOKO RD, BY, NNPC ROUND ABOUT'),
  (655, delta_state_id, 'UGBOLOKPOSO', '#68 HOSPITAL ROAD'),
  (656, delta_state_id, 'JEDDO', 'OBATTERN PLACE, JEDDO-UGOTON RD, AFTER AIRFORCE, MESS'),
  (657, delta_state_id, 'EKREJEBOR', 'QUESSEBEST HOTEL, #70 EKREJEBOR RD'),
  (658, delta_state_id, 'ARUMALA', '#27 ARUMALA STR, JESUS DAUGHTER, EVENT CENTER, ST'),
  (659, delta_state_id, 'EKREJEBOR-2', '1PIPELINE BEHIND ATMOSPHERE SEC, SCH'),
  (660, delta_state_id, 'OKOLOR', 'OKOLOR COMM, TOWN HALL, OKOLOR WATERSIDE'),
  (661, delta_state_id, 'ASABA DISTRICT', ''),
  (662, delta_state_id, 'ASABA', 'KM7 ASABA/BENIN, EXPRESSWAY, BESIDES FORMER, DEPUTY ASABA.'),
  (663, delta_state_id, 'BURUTU', 'BURUTU CEMENT, PLAZA DRIVE, INFANT JESUS RD'),
  (664, delta_state_id, 'OKPANAM 1', 'VANGUARD AVENUE OPP ASABA AIRPORT'),
  (665, delta_state_id, 'OKPANAM 2', 'OMA CO-OPERATIVE EVENT CENTER'),
  (666, delta_state_id, 'AGBOR-1', '#12 ODIM STR, BY, CALVARY GROUP, SCH, BOJI'),
  (667, delta_state_id, 'CABLE', 'ANGELIC PLAZA #76 NNEBISI RD, CABLE, POINT'),
  (668, delta_state_id, 'IBUSA', 'EZE-IHEGE HALL, UMUOZOMA, QUARTERS, OPP, UMUION BANK'),
  (669, delta_state_id, 'BEHIND STADIUM', '#13 OBI STR, BEHIND STEPHEN KESHI, STADIUM'),
  (670, delta_state_id, 'AGBOR 2', '#49 EKUJOMA RD, UMUNEDE'),
  (671, delta_state_id, 'ODUKE (NEW)', '#38 GOOD, SHEPHERD JUNC., ODUKE COMM'),
  (672, delta_state_id, 'OKWE', '#1 ABC CHIEF, IYASELE STR, BY, POLICE POST'),
  (673, delta_state_id, 'OKWE 2', 'NDUKA PLAZA, OKWE'),
  (674, delta_state_id, 'ALIOKPU', 'OLD SAPOBA RD, BY GENERAL LUCKY, IRABOR JUNC, IKA, SOUTH, AGBOR');
END $$;

INSERT INTO public.churches (branch_country, branch_state, name, address, directory_branch_id, is_active) VALUES
  ('NG', 'DE', 'AIRPORT RD', 'DANDANI EVENT, CENTER #128, AIRPORT ROAD', 625, 1),
  ('NG', 'DE', 'AJAMIMOGHA', '#55 AJAMIMOGHA RD, WARRI', 626, 1),
  ('NG', 'DE', 'AGBARHO', '#6 EWHERHE RD BY MODERN PRY SCH', 627, 1),
  ('NG', 'DE', 'AGBARHO OTOR', '#6 OKOSE STREET, OFF, AGBARHA/EMEVO, RD, AGBARHA-OTOR', 628, 1),
  ('NG', 'DE', 'ABRAKA 1', 'FORMER DOUBLE, DELIGHT FAST FOOD BY FSP JUNCTION', 629, 1),
  ('NG', 'DE', 'ABRAKA 2', '#204 OLD, ABRAKA/AGBOR RD, BESIDES WIMA, CLINIC, OKORHIRHE', 630, 1),
  ('NG', 'DE', 'AMEKPE (UGHELLI3)', 'EDAFE EVENT, CENTER, END OF, OCHUKO LANE, 1ST, AMEKPE', 631, 1),
  ('NG', 'DE', 'BOMADI', 'ORDELE EVENTS, HALL, GRA BOMADI, OPP LG CHAIRMAN', 632, 1),
  ('NG', 'DE', 'ENERHEN HQ', '#11 WARRI/SAPELE RD, BY ENERHEN, JUNC', 633, 1),
  ('NG', 'DE', 'ENHWE', 'EFE-OMOVUDU, EVENT CENTER, BESIDES ULEWE, QUARTER', 634, 1),
  ('NG', 'DE', 'EKPAN', '#3 NIGER CAT LINK, RD, OFF REFINERY, RD, AND NEPA, EXPRESSWAY, BEHIND CHICKEN REP', 635, 1),
  ('NG', 'DE', 'EKU', 'OLD AGBOR, SAPELE RD, BY STAFF, QUARTERS, OPP, SULEMAN POULTRY, EKU', 636, 1),
  ('NG', 'DE', 'EMEVOR', '#6 OKOSE STREET, OFF, AGBARHA/EMEVO, ROAD', 637, 1),
  ('NG', 'DE', 'IRRI', '#39 MISSIONS ROAD', 638, 1),
  ('NG', 'DE', 'JAKPA', '#2 EDU STREET, OFF JAKPA ROAD', 639, 1),
  ('NG', 'DE', 'JIBALE', 'FORMER JITOS, HOTEL OPP JIBALE, MKT, ORUWHORUN', 640, 1),
  ('NG', 'DE', 'KWALE', 'ADEGE STREET, BESIDES BENVO, TWINS HOTEL OFF, ASABA EXPRESS RD', 641, 1),
  ('NG', 'DE', 'OBIAROKO', 'EDEM ONAH EVENT CENTER ALONG, ABRAKA/OBIARUKU EXPRESS ROAD', 642, 1),
  ('NG', 'DE', 'OTOR UDU', 'EVWOR QUARTERS, HALL', 643, 1),
  ('NG', 'DE', 'MOFOR', '#191 DSC EXPRESS, WAY OPP EKETE, INLAND JUNCTION', 644, 1),
  ('NG', 'DE', 'OLEH', '#3 NEW EMEDE RD, BY YANGA MKT, OLEH', 645, 1),
  ('NG', 'DE', 'OLOMORO', '', 646, 1),
  ('NG', 'DE', 'OZORO', 'PARADISE HOTEL, BEHIND ZOUKUMOR PRIMARY SCHOOL', 647, 1),
  ('NG', 'DE', 'OWHELOGBO', '#86 HOSPITAL RD', 648, 1),
  ('NG', 'DE', 'PATANI', 'LOCAL, GOVERNMENT, COUNCIL, CONFERENCE HALL, EKISE PATANI.', 649, 1),
  ('NG', 'DE', 'SAPELE 1', 'COMM RD, OPP, OKIRIGWHE, COMM HALL, , SAPELE', 650, 1),
  ('NG', 'DE', 'SAPELE 2', '#1 EWETA LANE OPP PJ GOLDEN HOTEL, GANA', 651, 1),
  ('NG', 'DE', 'ABRAKA 3', 'POLICE STATION RD, BY LUCAS JUNCTION', 652, 1),
  ('NG', 'DE', 'UGHELLI 1', '#1 ERUOBOGA STR, BESIDE TOTAL CHILD SCH, AKPODIETE', 653, 1),
  ('NG', 'DE', 'UGHELLI 2', '#120 ISOKO RD, BY, NNPC ROUND ABOUT', 654, 1),
  ('NG', 'DE', 'UGBOLOKPOSO', '#68 HOSPITAL ROAD', 655, 1),
  ('NG', 'DE', 'JEDDO', 'OBATTERN PLACE, JEDDO-UGOTON RD, AFTER AIRFORCE, MESS', 656, 1),
  ('NG', 'DE', 'EKREJEBOR', 'QUESSEBEST HOTEL, #70 EKREJEBOR RD', 657, 1),
  ('NG', 'DE', 'ARUMALA', '#27 ARUMALA STR, JESUS DAUGHTER, EVENT CENTER, ST', 658, 1),
  ('NG', 'DE', 'EKREJEBOR-2', '1PIPELINE BEHIND ATMOSPHERE SEC, SCH', 659, 1),
  ('NG', 'DE', 'OKOLOR', 'OKOLOR COMM, TOWN HALL, OKOLOR WATERSIDE', 660, 1),
  ('NG', 'DE', 'ASABA DISTRICT', '', 661, 1),
  ('NG', 'DE', 'ASABA', 'KM7 ASABA/BENIN, EXPRESSWAY, BESIDES FORMER, DEPUTY ASABA.', 662, 1),
  ('NG', 'DE', 'BURUTU', 'BURUTU CEMENT, PLAZA DRIVE, INFANT JESUS RD', 663, 1),
  ('NG', 'DE', 'OKPANAM 1', 'VANGUARD AVENUE OPP ASABA AIRPORT', 664, 1),
  ('NG', 'DE', 'OKPANAM 2', 'OMA CO-OPERATIVE EVENT CENTER', 665, 1),
  ('NG', 'DE', 'AGBOR-1', '#12 ODIM STR, BY, CALVARY GROUP, SCH, BOJI', 666, 1),
  ('NG', 'DE', 'CABLE', 'ANGELIC PLAZA #76 NNEBISI RD, CABLE, POINT', 667, 1),
  ('NG', 'DE', 'IBUSA', 'EZE-IHEGE HALL, UMUOZOMA, QUARTERS, OPP, UMUION BANK', 668, 1),
  ('NG', 'DE', 'BEHIND STADIUM', '#13 OBI STR, BEHIND STEPHEN KESHI, STADIUM', 669, 1),
  ('NG', 'DE', 'AGBOR 2', '#49 EKUJOMA RD, UMUNEDE', 670, 1),
  ('NG', 'DE', 'ODUKE (NEW)', '#38 GOOD, SHEPHERD JUNC., ODUKE COMM', 671, 1),
  ('NG', 'DE', 'OKWE', '#1 ABC CHIEF, IYASELE STR, BY, POLICE POST', 672, 1),
  ('NG', 'DE', 'OKWE 2', 'NDUKA PLAZA, OKWE', 673, 1),
  ('NG', 'DE', 'ALIOKPU', 'OLD SAPOBA RD, BY GENERAL LUCKY, IRABOR JUNC, IKA, SOUTH, AGBOR', 674, 1);

INSERT INTO public.satellite_church_sites (continent, branch_country, branch_state, lga, site_name, is_active) VALUES
  ('Africa', 'NG', 'DE', '', 'AIRPORT RD', 1),
  ('Africa', 'NG', 'DE', '', 'AJAMIMOGHA', 1),
  ('Africa', 'NG', 'DE', '', 'AGBARHO', 1),
  ('Africa', 'NG', 'DE', '', 'AGBARHO OTOR', 1),
  ('Africa', 'NG', 'DE', '', 'ABRAKA 1', 1),
  ('Africa', 'NG', 'DE', '', 'ABRAKA 2', 1),
  ('Africa', 'NG', 'DE', '', 'AMEKPE (UGHELLI3)', 1),
  ('Africa', 'NG', 'DE', '', 'BOMADI', 1),
  ('Africa', 'NG', 'DE', '', 'ENERHEN HQ', 1),
  ('Africa', 'NG', 'DE', '', 'ENHWE', 1),
  ('Africa', 'NG', 'DE', '', 'EKPAN', 1),
  ('Africa', 'NG', 'DE', '', 'EKU', 1),
  ('Africa', 'NG', 'DE', '', 'EMEVOR', 1),
  ('Africa', 'NG', 'DE', '', 'IRRI', 1),
  ('Africa', 'NG', 'DE', '', 'JAKPA', 1),
  ('Africa', 'NG', 'DE', '', 'JIBALE', 1),
  ('Africa', 'NG', 'DE', '', 'KWALE', 1),
  ('Africa', 'NG', 'DE', '', 'OBIAROKO', 1),
  ('Africa', 'NG', 'DE', '', 'OTOR UDU', 1),
  ('Africa', 'NG', 'DE', '', 'MOFOR', 1),
  ('Africa', 'NG', 'DE', '', 'OLEH', 1),
  ('Africa', 'NG', 'DE', '', 'OLOMORO', 1),
  ('Africa', 'NG', 'DE', '', 'OZORO', 1),
  ('Africa', 'NG', 'DE', '', 'OWHELOGBO', 1),
  ('Africa', 'NG', 'DE', '', 'PATANI', 1),
  ('Africa', 'NG', 'DE', '', 'SAPELE 1', 1),
  ('Africa', 'NG', 'DE', '', 'SAPELE 2', 1),
  ('Africa', 'NG', 'DE', '', 'ABRAKA 3', 1),
  ('Africa', 'NG', 'DE', '', 'UGHELLI 1', 1),
  ('Africa', 'NG', 'DE', '', 'UGHELLI 2', 1),
  ('Africa', 'NG', 'DE', '', 'UGBOLOKPOSO', 1),
  ('Africa', 'NG', 'DE', '', 'JEDDO', 1),
  ('Africa', 'NG', 'DE', '', 'EKREJEBOR', 1),
  ('Africa', 'NG', 'DE', '', 'ARUMALA', 1),
  ('Africa', 'NG', 'DE', '', 'EKREJEBOR-2', 1),
  ('Africa', 'NG', 'DE', '', 'OKOLOR', 1),
  ('Africa', 'NG', 'DE', '', 'ASABA DISTRICT', 1),
  ('Africa', 'NG', 'DE', '', 'ASABA', 1),
  ('Africa', 'NG', 'DE', '', 'BURUTU', 1),
  ('Africa', 'NG', 'DE', '', 'OKPANAM 1', 1),
  ('Africa', 'NG', 'DE', '', 'OKPANAM 2', 1),
  ('Africa', 'NG', 'DE', '', 'AGBOR-1', 1),
  ('Africa', 'NG', 'DE', '', 'CABLE', 1),
  ('Africa', 'NG', 'DE', '', 'IBUSA', 1),
  ('Africa', 'NG', 'DE', '', 'BEHIND STADIUM', 1),
  ('Africa', 'NG', 'DE', '', 'AGBOR 2', 1),
  ('Africa', 'NG', 'DE', '', 'ODUKE (NEW)', 1),
  ('Africa', 'NG', 'DE', '', 'OKWE', 1),
  ('Africa', 'NG', 'DE', '', 'OKWE 2', 1),
  ('Africa', 'NG', 'DE', '', 'ALIOKPU', 1);

-- Ensure directory_states display name is canonical.
UPDATE public.directory_states ds
SET name = 'Delta'
FROM public.directory_countries dc
WHERE dc.id = ds.country_id
  AND upper(trim(dc.branch_country_code)) = 'NG'
  AND upper(trim(ds.branch_state_code)) = 'DE';

-- Remap legacy corrupted Delta satellite names (223. … 234.) on linked records.
UPDATE public.admins SET satellite_site = 'AIRPORT RD'
WHERE upper(trim(branch_country)) = 'NG'
  AND upper(trim(branch_state)) IN ('DE', 'DELTA')
  AND trim(satellite_site) = '223.';
UPDATE public.registrations SET satellite_site = 'AIRPORT RD'
WHERE upper(trim(branch_country)) = 'NG'
  AND upper(trim(branch_state)) IN ('DE', 'DELTA')
  AND trim(satellite_site) = '223.';
UPDATE public.admins SET satellite_site = 'AJAMIMOGHA'
WHERE upper(trim(branch_country)) = 'NG'
  AND upper(trim(branch_state)) IN ('DE', 'DELTA')
  AND trim(satellite_site) = '224.';
UPDATE public.registrations SET satellite_site = 'AJAMIMOGHA'
WHERE upper(trim(branch_country)) = 'NG'
  AND upper(trim(branch_state)) IN ('DE', 'DELTA')
  AND trim(satellite_site) = '224.';
UPDATE public.admins SET satellite_site = 'AGBARHO'
WHERE upper(trim(branch_country)) = 'NG'
  AND upper(trim(branch_state)) IN ('DE', 'DELTA')
  AND trim(satellite_site) = '225.';
UPDATE public.registrations SET satellite_site = 'AGBARHO'
WHERE upper(trim(branch_country)) = 'NG'
  AND upper(trim(branch_state)) IN ('DE', 'DELTA')
  AND trim(satellite_site) = '225.';
UPDATE public.admins SET satellite_site = 'AGBARHO OTOR'
WHERE upper(trim(branch_country)) = 'NG'
  AND upper(trim(branch_state)) IN ('DE', 'DELTA')
  AND trim(satellite_site) = '226.';
UPDATE public.registrations SET satellite_site = 'AGBARHO OTOR'
WHERE upper(trim(branch_country)) = 'NG'
  AND upper(trim(branch_state)) IN ('DE', 'DELTA')
  AND trim(satellite_site) = '226.';
UPDATE public.admins SET satellite_site = 'ABRAKA 1'
WHERE upper(trim(branch_country)) = 'NG'
  AND upper(trim(branch_state)) IN ('DE', 'DELTA')
  AND trim(satellite_site) = '227.';
UPDATE public.registrations SET satellite_site = 'ABRAKA 1'
WHERE upper(trim(branch_country)) = 'NG'
  AND upper(trim(branch_state)) IN ('DE', 'DELTA')
  AND trim(satellite_site) = '227.';
UPDATE public.admins SET satellite_site = 'ABRAKA 2'
WHERE upper(trim(branch_country)) = 'NG'
  AND upper(trim(branch_state)) IN ('DE', 'DELTA')
  AND trim(satellite_site) = '228.';
UPDATE public.registrations SET satellite_site = 'ABRAKA 2'
WHERE upper(trim(branch_country)) = 'NG'
  AND upper(trim(branch_state)) IN ('DE', 'DELTA')
  AND trim(satellite_site) = '228.';
UPDATE public.admins SET satellite_site = 'AMEKPE (UGHELLI3)'
WHERE upper(trim(branch_country)) = 'NG'
  AND upper(trim(branch_state)) IN ('DE', 'DELTA')
  AND trim(satellite_site) = '229.';
UPDATE public.registrations SET satellite_site = 'AMEKPE (UGHELLI3)'
WHERE upper(trim(branch_country)) = 'NG'
  AND upper(trim(branch_state)) IN ('DE', 'DELTA')
  AND trim(satellite_site) = '229.';
UPDATE public.admins SET satellite_site = 'BOMADI'
WHERE upper(trim(branch_country)) = 'NG'
  AND upper(trim(branch_state)) IN ('DE', 'DELTA')
  AND trim(satellite_site) = '230.';
UPDATE public.registrations SET satellite_site = 'BOMADI'
WHERE upper(trim(branch_country)) = 'NG'
  AND upper(trim(branch_state)) IN ('DE', 'DELTA')
  AND trim(satellite_site) = '230.';
UPDATE public.admins SET satellite_site = 'ENERHEN HQ'
WHERE upper(trim(branch_country)) = 'NG'
  AND upper(trim(branch_state)) IN ('DE', 'DELTA')
  AND trim(satellite_site) = '231.';
UPDATE public.registrations SET satellite_site = 'ENERHEN HQ'
WHERE upper(trim(branch_country)) = 'NG'
  AND upper(trim(branch_state)) IN ('DE', 'DELTA')
  AND trim(satellite_site) = '231.';
UPDATE public.admins SET satellite_site = 'ENHWE'
WHERE upper(trim(branch_country)) = 'NG'
  AND upper(trim(branch_state)) IN ('DE', 'DELTA')
  AND trim(satellite_site) = '232.';
UPDATE public.registrations SET satellite_site = 'ENHWE'
WHERE upper(trim(branch_country)) = 'NG'
  AND upper(trim(branch_state)) IN ('DE', 'DELTA')
  AND trim(satellite_site) = '232.';
UPDATE public.admins SET satellite_site = 'EKPAN'
WHERE upper(trim(branch_country)) = 'NG'
  AND upper(trim(branch_state)) IN ('DE', 'DELTA')
  AND trim(satellite_site) = '233.';
UPDATE public.registrations SET satellite_site = 'EKPAN'
WHERE upper(trim(branch_country)) = 'NG'
  AND upper(trim(branch_state)) IN ('DE', 'DELTA')
  AND trim(satellite_site) = '233.';
UPDATE public.admins SET satellite_site = 'EKU'
WHERE upper(trim(branch_country)) = 'NG'
  AND upper(trim(branch_state)) IN ('DE', 'DELTA')
  AND trim(satellite_site) = '234.';
UPDATE public.registrations SET satellite_site = 'EKU'
WHERE upper(trim(branch_country)) = 'NG'
  AND upper(trim(branch_state)) IN ('DE', 'DELTA')
  AND trim(satellite_site) = '234.';

SELECT setval(
  pg_get_serial_sequence('public.directory_branches', 'id'),
  (SELECT coalesce(max(id), 1) FROM public.directory_branches)
);
SELECT setval(
  pg_get_serial_sequence('public.churches', 'id'),
  (SELECT coalesce(max(id), 1) FROM public.churches)
);
