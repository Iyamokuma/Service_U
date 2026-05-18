-- Normalized phone/email identifiers for duplicate registration prevention.

alter table public.registrations
  add column if not exists phone1_digits text,
  add column if not exists phone2_digits text,
  add column if not exists email_normalized text;

update public.registrations
set
  phone1_digits = nullif(regexp_replace(coalesce(phone1, ''), '[^0-9]', '', 'g'), ''),
  phone2_digits = case
    when phone2 is null or trim(phone2) = '' then null
    else nullif(regexp_replace(phone2, '[^0-9]', '', 'g'), '')
  end,
  email_normalized = case
    when email is null or trim(email) = '' then null
    else lower(trim(email))
  end
where phone1_digits is null and phone2_digits is null and email_normalized is null;

-- Drop too-short phone keys so unique index does not block empty strings
update public.registrations set phone1_digits = null where phone1_digits is not null and length(phone1_digits) < 7;
update public.registrations set phone2_digits = null where phone2_digits is not null and length(phone2_digits) < 7;

create unique index if not exists idx_registrations_phone1_digits_active
  on public.registrations (phone1_digits)
  where phone1_digits is not null
    and length(phone1_digits) >= 7
    and status not in ('rejected', 'archived');

create unique index if not exists idx_registrations_email_normalized_active
  on public.registrations (email_normalized)
  where email_normalized is not null
    and status not in ('rejected', 'archived');

create or replace function public.registrations_sync_identity_columns()
returns trigger
language plpgsql
as $$
begin
  new.phone1_digits := nullif(regexp_replace(coalesce(new.phone1, ''), '[^0-9]', '', 'g'), '');
  if new.phone1_digits is not null and length(new.phone1_digits) < 7 then
    new.phone1_digits := null;
  end if;

  if new.phone2 is null or trim(new.phone2) = '' then
    new.phone2_digits := null;
  else
    new.phone2_digits := nullif(regexp_replace(new.phone2, '[^0-9]', '', 'g'), '');
    if new.phone2_digits is not null and length(new.phone2_digits) < 7 then
      new.phone2_digits := null;
    end if;
  end if;

  if new.email is null or trim(new.email) = '' then
    new.email_normalized := null;
  else
    new.email_normalized := lower(trim(new.email));
  end if;

  return new;
end;
$$;

drop trigger if exists trg_registrations_sync_identity on public.registrations;
create trigger trg_registrations_sync_identity
  before insert or update of phone1, phone2, email
  on public.registrations
  for each row
  execute function public.registrations_sync_identity_columns();
