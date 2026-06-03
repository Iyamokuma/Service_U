-- Pause email invite gate: clear pending invite tokens so password login works immediately.

update public.admins
set
  invite_token = null,
  invite_expires_at = null,
  must_change_password = 0
where invite_token is not null or must_change_password = 1;
