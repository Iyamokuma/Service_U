-- Ensure a single NG / Abia directory state (canonical ABI) and re-point branches & churches.

DO $$
DECLARE
  ng_country_id integer;
  canon_id integer;
  canon_code text := 'ABI';
  dup record;
BEGIN
  SELECT id INTO ng_country_id FROM public.directory_countries WHERE upper(trim(branch_country_code)) = 'NG' LIMIT 1;
  IF ng_country_id IS NULL THEN RETURN; END IF;

  SELECT ds.id INTO canon_id
  FROM public.directory_states ds
  WHERE ds.country_id = ng_country_id AND upper(trim(ds.branch_state_code)) = canon_code
  ORDER BY ds.id
  LIMIT 1;

  IF canon_id IS NULL THEN
    SELECT ds.id INTO canon_id
    FROM public.directory_states ds
    WHERE ds.country_id = ng_country_id
      AND lower(regexp_replace(trim(ds.name), '\s+state\s*$', '', 'i')) = 'abia'
    ORDER BY length(coalesce(nullif(trim(ds.branch_state_code), ''), 'ZZZZ')), ds.id
    LIMIT 1;
    IF canon_id IS NOT NULL THEN
      UPDATE public.directory_states SET branch_state_code = canon_code, name = 'Abia' WHERE id = canon_id;
    END IF;
  END IF;

  IF canon_id IS NULL THEN RETURN; END IF;

  FOR dup IN
    SELECT ds.id, ds.branch_state_code
    FROM public.directory_states ds
    WHERE ds.country_id = ng_country_id
      AND ds.id <> canon_id
      AND (
        lower(regexp_replace(trim(ds.name), '\s+state\s*$', '', 'i')) = 'abia'
        OR upper(trim(ds.branch_state_code)) LIKE 'ABI%'
        OR upper(trim(ds.branch_state_code)) IN ('ABIASTATE', 'ABIASTAT', 'ABIA')
      )
  LOOP
    UPDATE public.directory_branches SET state_id = canon_id WHERE state_id = dup.id;

    UPDATE public.churches SET branch_state = canon_code
    WHERE upper(trim(branch_country)) = 'NG' AND trim(branch_state) = dup.branch_state_code;

    DELETE FROM public.satellite_church_sites sat_old
    WHERE upper(trim(sat_old.branch_country)) = 'NG'
      AND trim(sat_old.branch_state) = dup.branch_state_code
      AND EXISTS (
        SELECT 1
        FROM public.satellite_church_sites sat_keep
        WHERE upper(trim(sat_keep.branch_country)) = 'NG'
          AND upper(trim(sat_keep.branch_state)) = canon_code
          AND trim(sat_keep.lga) = trim(sat_old.lga)
          AND trim(sat_keep.site_name) = trim(sat_old.site_name)
          AND sat_keep.id <> sat_old.id
      );

    UPDATE public.satellite_church_sites SET branch_state = canon_code
    WHERE upper(trim(branch_country)) = 'NG' AND trim(branch_state) = dup.branch_state_code;

    UPDATE public.registrations SET branch_state = canon_code
    WHERE upper(trim(branch_country)) = 'NG' AND trim(branch_state) = dup.branch_state_code;

    DELETE FROM public.directory_states WHERE id = dup.id;
  END LOOP;
END $$;
