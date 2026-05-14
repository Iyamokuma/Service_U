create extension if not exists "pgcrypto";

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  surname text not null,
  other_names text,
  dob_month text,
  dob_day text,
  dob_year text,
  sex text,
  marital_status text,
  nationality text,
  address text,
  bus_stop text,
  branch_country text,
  branch_state text,
  phone1 text not null,
  phone2 text,
  email text,
  workplace text,
  tithe_card text,
  homecell text,
  joined_church_month text,
  joined_church_year text,
  born_again text,
  born_again_year text,
  foundation text,
  foundation_month text,
  foundation_year text,
  baptised text,
  baptised_month text,
  baptised_year text,
  wolbi text,
  wolbi_month text,
  wolbi_year text,
  wolbi_level text,
  unit_id bigint,
  unit_name text,
  sub_unit text,
  status text not null default 'new',
  notes text,
  submitted_at timestamptz not null default now(),
  photo_path text
);

create index if not exists idx_registrations_submitted_at on public.registrations (submitted_at desc);
create index if not exists idx_registrations_status on public.registrations (status);
create index if not exists idx_registrations_unit_id on public.registrations (unit_id);
create index if not exists idx_registrations_email on public.registrations (email);
