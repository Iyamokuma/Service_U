-- Email OTP challenges for admin login (all roles).

create table if not exists public.admin_login_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  admin_id integer not null references public.admins(id) on delete cascade,
  otp_hash text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  used_at timestamptz,
  last_sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  ip_address text not null default ''
);

create index if not exists idx_admin_login_otp_admin_active
  on public.admin_login_otp_challenges (admin_id, created_at desc)
  where used_at is null;

create index if not exists idx_admin_login_otp_expires
  on public.admin_login_otp_challenges (expires_at)
  where used_at is null;
