-- Ghana: four named regions in directory_states (not a single GH catch-all).
-- Ensures admin State Branch Admin picker shows Greater Accra, Ashanti Region, etc.

DO $$
DECLARE
  gh_id integer;
  legacy record;
  region record;
BEGIN
  SELECT id INTO gh_id
  FROM public.directory_countries
  WHERE upper(trim(branch_country_code)) = 'GH'
  LIMIT 1;

  IF gh_id IS NULL THEN
    RAISE NOTICE 'fix_ghana_regions: no GH country row';
    RETURN;
  END IF;

  FOR region IN
    SELECT *
    FROM (
      VALUES
        ('Ashanti Region', 'AS'),
        ('Central Region', 'CR'),
        ('Greater Accra', 'GA'),
        ('Western Region', 'WR')
    ) AS v(name, code)
  LOOP
    UPDATE public.directory_states
    SET name = region.name
    WHERE country_id = gh_id
      AND upper(trim(branch_state_code)) = region.code;

    IF NOT FOUND THEN
      INSERT INTO public.directory_states (country_id, name, branch_state_code)
      VALUES (gh_id, region.name, region.code);
    END IF;
  END LOOP;

  SELECT ds.id, ds.branch_state_code
  INTO legacy
  FROM public.directory_states ds
  WHERE ds.country_id = gh_id
    AND upper(trim(ds.branch_state_code)) = 'GH'
  LIMIT 1;

  IF legacy.id IS NOT NULL THEN
    UPDATE public.directory_branches db
    SET state_id = target.id
    FROM public.directory_states target
    JOIN public.churches ch ON ch.directory_branch_id = db.id
    WHERE db.state_id = legacy.id
      AND target.country_id = gh_id
      AND upper(trim(target.branch_state_code)) = upper(trim(ch.branch_state))
      AND upper(trim(ch.branch_country)) = 'GH';

    UPDATE public.directory_branches db
    SET state_id = (
      SELECT ds.id
      FROM public.directory_states ds
      WHERE ds.country_id = gh_id
        AND upper(trim(ds.branch_state_code)) = 'GA'
      LIMIT 1
    )
    WHERE db.state_id = legacy.id;

    DELETE FROM public.directory_branches WHERE state_id = legacy.id;
    DELETE FROM public.directory_states WHERE id = legacy.id;
  END IF;
END $$;

UPDATE public.directory_states ds
SET name = CASE upper(trim(ds.branch_state_code))
  WHEN 'AS' THEN 'Ashanti Region'
  WHEN 'CR' THEN 'Central Region'
  WHEN 'GA' THEN 'Greater Accra'
  WHEN 'WR' THEN 'Western Region'
  ELSE ds.name
END
FROM public.directory_countries dc
WHERE dc.id = ds.country_id
  AND upper(trim(dc.branch_country_code)) = 'GH';
