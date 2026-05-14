-- Merge mistaken duplicate "Abia" directory_states (slug codes like ABIASTATE) into canonical NG / ABI.
-- Re-point directory_branches, churches, and satellite_church_sites; then remove duplicate rows.

DO $$
DECLARE
  ng_country_id integer;
  canon_id integer;
  canon_code text := 'ABI';
  dup record;
BEGIN
  SELECT id INTO ng_country_id FROM public.directory_countries WHERE upper(trim(branch_country_code)) = 'NG' LIMIT 1;
  IF ng_country_id IS NULL THEN
    RAISE NOTICE 'merge_abia_dup: no NG country row';
    RETURN;
  END IF;

  SELECT id INTO canon_id
  FROM public.directory_states
  WHERE country_id = ng_country_id AND upper(trim(branch_state_code)) = canon_code
  ORDER BY id
  LIMIT 1;

  IF canon_id IS NULL THEN
    RAISE NOTICE 'merge_abia_dup: no canonical ABI state';
    RETURN;
  END IF;

  FOR dup IN
    SELECT ds.id, ds.branch_state_code
    FROM public.directory_states ds
    WHERE ds.country_id = ng_country_id
      AND ds.id <> canon_id
      AND upper(trim(ds.branch_state_code)) <> canon_code
      AND (
        upper(trim(ds.branch_state_code)) LIKE 'ABI%'
        OR upper(trim(ds.branch_state_code)) IN ('ABIASTATE', 'ABIASTAT', 'ABIA')
      )
  LOOP
    UPDATE public.directory_branches SET state_id = canon_id WHERE state_id = dup.id;

    UPDATE public.churches
    SET branch_state = canon_code
    WHERE upper(trim(branch_country)) = 'NG'
      AND trim(branch_state) = dup.branch_state_code;

    UPDATE public.satellite_church_sites
    SET branch_state = canon_code
    WHERE upper(trim(branch_country)) = 'NG'
      AND trim(branch_state) = dup.branch_state_code;

    DELETE FROM public.directory_states WHERE id = dup.id;
  END LOOP;
END $$;
