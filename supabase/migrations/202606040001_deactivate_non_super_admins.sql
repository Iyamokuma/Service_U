-- Deactivate all admin accounts except Super Admin so downline must be re-onboarded via email invite.

update public.admins
set
  is_active = 0,
  invite_token = null,
  invite_expires_at = null
where role is distinct from 'super_admin';

update public.admins
set
  is_active = 1,
  must_change_password = 0,
  invite_token = null,
  invite_expires_at = null
where role = 'super_admin';
