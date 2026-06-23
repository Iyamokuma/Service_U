-- Store full state/region names in branch_state columns (no abbreviations like RI, GA, FCT).
-- directory_states.name is the canonical label; branch_state_code stays the stable internal key.

-- ---------------------------------------------------------------------------
-- 1) Canonical full names on directory_states
-- ---------------------------------------------------------------------------
UPDATE public.directory_states ds
SET name = CASE upper(trim(ds.branch_state_code))
  WHEN 'PORTONOVO' THEN 'Littoral / Ouémé Department (Porto-Novo area)'
  WHEN 'COTONOU' THEN 'Littoral Department (Cotonou area)'
  WHEN 'DOUALA' THEN 'Littoral Region (Douala area)'
  WHEN 'SW' THEN 'South West Region'
  WHEN 'ON' THEN 'Ontario'
  WHEN 'GZ' THEN 'Guangzhou'
  WHEN 'CY' THEN 'Cyprus'
  WHEN 'KANIFING' THEN 'Kanifing Municipal Council'
  WHEN 'AS' THEN 'Ashanti Region'
  WHEN 'CR' THEN 'Central Region'
  WHEN 'GA' THEN 'Greater Accra'
  WHEN 'WR' THEN 'Western Region'
  WHEN 'ABI' THEN 'Abia'
  WHEN 'ADM' THEN 'Adamawa'
  WHEN 'AKB' THEN 'Akwa Ibom'
  WHEN 'ANA' THEN 'Anambra'
  WHEN 'BAU' THEN 'Bauchi'
  WHEN 'BAY' THEN 'Bayelsa'
  WHEN 'BEN' THEN 'Benue'
  WHEN 'BOR' THEN 'Borno'
  WHEN 'CRV' THEN 'Cross River'
  WHEN 'DE' THEN 'Delta'
  WHEN 'EBY' THEN 'Ebonyi'
  WHEN 'EDO' THEN 'Edo'
  WHEN 'EKI' THEN 'Ekiti'
  WHEN 'ENU' THEN 'Enugu'
  WHEN 'FCT' THEN 'Federal Capital Territory'
  WHEN 'GOM' THEN 'Gombe'
  WHEN 'IMO' THEN 'Imo'
  WHEN 'JIG' THEN 'Jigawa'
  WHEN 'KAD' THEN 'Kaduna'
  WHEN 'KAN' THEN 'Kano'
  WHEN 'KAT' THEN 'Katsina'
  WHEN 'KEB' THEN 'Kebbi'
  WHEN 'KOG' THEN 'Kogi'
  WHEN 'KWA' THEN 'Kwara'
  WHEN 'LA' THEN 'Lagos'
  WHEN 'NAS' THEN 'Nasarawa'
  WHEN 'NIE' THEN 'Niger'
  WHEN 'OGU' THEN 'Ogun'
  WHEN 'OND' THEN 'Ondo'
  WHEN 'OSU' THEN 'Osun'
  WHEN 'OYO' THEN 'Oyo'
  WHEN 'PLA' THEN 'Plateau'
  WHEN 'RI' THEN 'Rivers'
  WHEN 'SOK' THEN 'Sokoto'
  WHEN 'TAR' THEN 'Taraba'
  WHEN 'YOB' THEN 'Yobe'
  WHEN 'ZAM' THEN 'Zamfara'
  WHEN 'GE' THEN 'Geneva'
  WHEN 'DU' THEN 'Dubai'
  WHEN 'LONDON' THEN 'England (Greater London area)'
  WHEN 'SCOT' THEN 'Scotland'
  WHEN 'AL' THEN 'Alabama'
  WHEN 'MD' THEN 'Maryland'
  WHEN 'PA' THEN 'Pennsylvania'
  WHEN 'TX' THEN 'Texas'
  ELSE ds.name
END
FROM public.directory_countries dc
WHERE dc.id = ds.country_id;

-- Rows whose display name was only the abbreviation → use canonical name above.
UPDATE public.directory_states ds
SET name = CASE upper(trim(ds.branch_state_code))
  WHEN 'AS' THEN 'Ashanti Region'
  WHEN 'CR' THEN 'Central Region'
  WHEN 'GA' THEN 'Greater Accra'
  WHEN 'WR' THEN 'Western Region'
  ELSE ds.name
END
WHERE upper(trim(ds.name)) = upper(trim(ds.branch_state_code))
   OR trim(ds.name) = '';

-- ---------------------------------------------------------------------------
-- 2) Resolve legacy code → full name (SQL helper for backfill)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.branch_state_full_name(p_country text, p_state text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    (
      SELECT trim(ds.name)
      FROM public.directory_states ds
      INNER JOIN public.directory_countries dc ON dc.id = ds.country_id
      WHERE upper(trim(dc.branch_country_code)) = upper(trim(p_country))
        AND (
          upper(trim(ds.branch_state_code)) = upper(trim(p_state))
          OR lower(trim(ds.name)) = lower(trim(p_state))
        )
      ORDER BY length(trim(ds.branch_state_code))
      LIMIT 1
    ),
    nullif(trim(p_state), '')
  );
$$;

-- ---------------------------------------------------------------------------
-- 3) Backfill branch_state on all tables that store it
-- ---------------------------------------------------------------------------
UPDATE public.churches ch
SET branch_state = public.branch_state_full_name(ch.branch_country, ch.branch_state)
WHERE trim(coalesce(ch.branch_state, '')) <> ''
  AND public.branch_state_full_name(ch.branch_country, ch.branch_state) IS NOT NULL
  AND trim(ch.branch_state) <> trim(public.branch_state_full_name(ch.branch_country, ch.branch_state));

UPDATE public.satellite_church_sites sat
SET branch_state = public.branch_state_full_name(sat.branch_country, sat.branch_state)
WHERE trim(coalesce(sat.branch_state, '')) <> ''
  AND public.branch_state_full_name(sat.branch_country, sat.branch_state) IS NOT NULL
  AND trim(sat.branch_state) <> trim(public.branch_state_full_name(sat.branch_country, sat.branch_state));

UPDATE public.registrations reg
SET branch_state = public.branch_state_full_name(reg.branch_country, reg.branch_state)
WHERE trim(coalesce(reg.branch_country, '')) <> ''
  AND trim(coalesce(reg.branch_state, '')) <> ''
  AND public.branch_state_full_name(reg.branch_country, reg.branch_state) IS NOT NULL
  AND trim(reg.branch_state) <> trim(public.branch_state_full_name(reg.branch_country, reg.branch_state));

UPDATE public.admins adm
SET branch_state = public.branch_state_full_name(adm.branch_country, adm.branch_state)
WHERE trim(coalesce(adm.branch_country, '')) <> ''
  AND trim(coalesce(adm.branch_state, '')) <> ''
  AND public.branch_state_full_name(adm.branch_country, adm.branch_state) IS NOT NULL
  AND trim(adm.branch_state) <> trim(public.branch_state_full_name(adm.branch_country, adm.branch_state));

UPDATE public.announcements ann
SET scope_branch_state = public.branch_state_full_name(ann.branch_country, ann.scope_branch_state)
WHERE trim(coalesce(ann.branch_country, '')) <> ''
  AND trim(coalesce(ann.scope_branch_state, '')) <> ''
  AND public.branch_state_full_name(ann.branch_country, ann.scope_branch_state) IS NOT NULL
  AND trim(ann.scope_branch_state) <> trim(public.branch_state_full_name(ann.branch_country, ann.scope_branch_state));

-- Location catalog proposals (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'location_catalog_requests'
  ) THEN
    EXECUTE $sql$
      UPDATE public.location_catalog_requests lcr
      SET branch_state = public.branch_state_full_name(lcr.branch_country, lcr.branch_state)
      WHERE trim(coalesce(lcr.branch_state, '')) <> ''
        AND public.branch_state_full_name(lcr.branch_country, lcr.branch_state) IS NOT NULL
        AND trim(lcr.branch_state) <> trim(public.branch_state_full_name(lcr.branch_country, lcr.branch_state))
    $sql$;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4) Auto-normalize branch_state on future writes (code or name → full name)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_branch_state_full_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.branch_country IS NOT NULL AND trim(coalesce(NEW.branch_state, '')) <> '' THEN
    NEW.branch_state := public.branch_state_full_name(NEW.branch_country, NEW.branch_state);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS churches_branch_state_full_name ON public.churches;
CREATE TRIGGER churches_branch_state_full_name
  BEFORE INSERT OR UPDATE OF branch_country, branch_state ON public.churches
  FOR EACH ROW EXECUTE FUNCTION public.trg_branch_state_full_name();

DROP TRIGGER IF EXISTS satellite_sites_branch_state_full_name ON public.satellite_church_sites;
CREATE TRIGGER satellite_sites_branch_state_full_name
  BEFORE INSERT OR UPDATE OF branch_country, branch_state ON public.satellite_church_sites
  FOR EACH ROW EXECUTE FUNCTION public.trg_branch_state_full_name();

DROP TRIGGER IF EXISTS registrations_branch_state_full_name ON public.registrations;
CREATE TRIGGER registrations_branch_state_full_name
  BEFORE INSERT OR UPDATE OF branch_country, branch_state ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.trg_branch_state_full_name();

DROP TRIGGER IF EXISTS admins_branch_state_full_name ON public.admins;
CREATE TRIGGER admins_branch_state_full_name
  BEFORE INSERT OR UPDATE OF branch_country, branch_state ON public.admins
  FOR EACH ROW EXECUTE FUNCTION public.trg_branch_state_full_name();

CREATE OR REPLACE FUNCTION public.trg_announcement_scope_branch_state_full_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.branch_country IS NOT NULL AND trim(coalesce(NEW.scope_branch_state, '')) <> '' THEN
    NEW.scope_branch_state := public.branch_state_full_name(NEW.branch_country, NEW.scope_branch_state);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS announcements_scope_branch_state_full_name ON public.announcements;
CREATE TRIGGER announcements_scope_branch_state_full_name
  BEFORE INSERT OR UPDATE OF branch_country, scope_branch_state ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.trg_announcement_scope_branch_state_full_name();
