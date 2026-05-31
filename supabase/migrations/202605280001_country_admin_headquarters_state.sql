-- Country Admin accounts include a headquarters state (dual Country + State role).
-- Existing rows without branch_state get the first valid state for their country (Abia for NG).

UPDATE admins
SET branch_state = 'ABI'
WHERE role = 'country_super_admin'
  AND branch_country = 'NG'
  AND (branch_state IS NULL OR TRIM(branch_state) = '');

UPDATE admins
SET branch_state = branch_country
WHERE role = 'country_super_admin'
  AND branch_country IS NOT NULL
  AND TRIM(branch_country) <> ''
  AND (branch_state IS NULL OR TRIM(branch_state) = '')
  AND branch_country <> 'NG';
