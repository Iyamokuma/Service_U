-- Remove all admin accounts except Super Admin.
-- Downline must be re-created via email invite only.
-- Cascades: admin_requests, admin_notifications, overdue_notify_dedup.

delete from public.admins
where role is distinct from 'super_admin';

update public.admins
set
  is_active = 1,
  must_change_password = 0,
  invite_token = null,
  invite_expires_at = null
where role = 'super_admin';

select setval(
  pg_get_serial_sequence('public.admins', 'id'),
  coalesce((select max(id) from public.admins), 1)
);
