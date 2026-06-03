-- Admin invite / first-login password setup (Super & General Admin created accounts).

alter table public.admins
  add column if not exists must_change_password smallint not null default 0;

alter table public.admins
  add column if not exists invite_token text;

alter table public.admins
  add column if not exists invite_expires_at timestamptz;

create unique index if not exists idx_admins_invite_token
  on public.admins (invite_token)
  where invite_token is not null;
