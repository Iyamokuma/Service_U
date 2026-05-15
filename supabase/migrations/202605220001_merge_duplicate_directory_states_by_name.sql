-- Merge directory_states duplicated by normalized name (e.g. Abia vs ABIASTATE) under the same country.
-- Keeps the row with the shortest branch_state_code; re-points branches, churches, satellite sites.

DO $$
DECLARE
  rec record;
  canon_id integer;
  canon_code text;
BEGIN
  FOR rec IN
    SELECT
      ds.country_id,
      lower(regexp_replace(trim(ds.name), '\s+state\s*$', '', 'i')) AS nname,
      array_agg(ds.id ORDER BY length(coalesce(nullif(trim(ds.branch_state_code), ''), 'ZZZZ')), ds.id) AS ids,
      array_agg(trim(ds.branch_state_code) ORDER BY length(coalesce(nullif(trim(ds.branch_state_code), ''), 'ZZZZ')), ds.id) AS codes
    FROM public.directory_states ds
    WHERE trim(coalesce(ds.name, '')) <> ''
    GROUP BY ds.country_id, lower(regexp_replace(trim(ds.name), '\s+state\s*$', '', 'i'))
    HAVING count(*) > 1
  LOOP
    canon_id := rec.ids[1];
    canon_code := rec.codes[1];
    IF canon_code IS NULL OR canon_code = '' THEN
      CONTINUE;
    END IF;

    FOR i IN 2..array_length(rec.ids, 1) LOOP
      UPDATE public.directory_branches SET state_id = canon_id WHERE state_id = rec.ids[i];

      UPDATE public.churches ch
      SET branch_state = canon_code
      FROM public.directory_countries dc
      WHERE dc.id = rec.country_id
        AND upper(trim(ch.branch_country)) = upper(trim(dc.branch_country_code))
        AND trim(ch.branch_state) = rec.codes[i];

      -- Drop duplicate-state satellite rows when canonical (country, state, lga, site) already exists
      DELETE FROM public.satellite_church_sites sat_old
      USING public.directory_countries dc
      WHERE dc.id = rec.country_id
        AND upper(trim(sat_old.branch_country)) = upper(trim(dc.branch_country_code))
        AND trim(sat_old.branch_state) = rec.codes[i]
        AND EXISTS (
          SELECT 1
          FROM public.satellite_church_sites sat_keep
          WHERE upper(trim(sat_keep.branch_country)) = upper(trim(sat_old.branch_country))
            AND upper(trim(sat_keep.branch_state)) = upper(canon_code)
            AND trim(sat_keep.lga) = trim(sat_old.lga)
            AND trim(sat_keep.site_name) = trim(sat_old.site_name)
            AND sat_keep.id <> sat_old.id
        );

      UPDATE public.satellite_church_sites sat
      SET branch_state = canon_code
      FROM public.directory_countries dc
      WHERE dc.id = rec.country_id
        AND upper(trim(sat.branch_country)) = upper(trim(dc.branch_country_code))
        AND trim(sat.branch_state) = rec.codes[i];

      UPDATE public.registrations reg
      SET branch_state = canon_code
      FROM public.directory_countries dc
      WHERE dc.id = rec.country_id
        AND upper(trim(reg.branch_country)) = upper(trim(dc.branch_country_code))
        AND trim(reg.branch_state) = rec.codes[i];

      DELETE FROM public.directory_states WHERE id = rec.ids[i];
    END LOOP;
  END LOOP;
END $$;
