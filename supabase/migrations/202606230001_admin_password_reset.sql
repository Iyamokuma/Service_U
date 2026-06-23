-- Self-service password reset for non–Super Admin accounts (email link).

alter table public.admins
  add column if not exists password_reset_token text;

alter table public.admins
  add column if not exists password_reset_expires_at timestamptz;

create unique index if not exists idx_admins_password_reset_token
  on public.admins (password_reset_token)
  where password_reset_token is not null;
