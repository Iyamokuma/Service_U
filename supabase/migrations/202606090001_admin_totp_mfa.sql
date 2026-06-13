-- Authenticator (TOTP) MFA for admins + 11-day enrollment grace tracking.

alter table public.admins
  add column if not exists dashboard_activated_at timestamptz,
  add column if not exists totp_enabled boolean not null default false,
  add column if not exists totp_secret_encrypted text,
  add column if not exists totp_enrolled_at timestamptz;

alter table public.admin_login_otp_challenges
  add column if not exists otp_emailed_at timestamptz;

create index if not exists idx_admins_totp_enabled on public.admins (totp_enabled) where totp_enabled = true;
create index if not exists idx_admins_dashboard_activated on public.admins (dashboard_activated_at);

update public.admins
set dashboard_activated_at = coalesce(last_login, now())
where dashboard_activated_at is null
  and role is distinct from 'super_admin'
  and coalesce(must_change_password, 0) = 0
  and invite_token is null;
