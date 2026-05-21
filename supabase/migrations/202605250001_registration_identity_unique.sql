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
  end;

-- Drop too-short phone keys so unique index does not block empty strings
update public.registrations set phone1_digits = null where phone1_digits is not null and length(phone1_digits) < 7;
update public.registrations set phone2_digits = null where phone2_digits is not null and length(phone2_digits) < 7;

-- Existing data may contain duplicate active phones/emails; archive extras before unique indexes.
-- Keeps the best pipeline record per key (accepted > in progress > new), then earliest submission.
do $$
declare
  dup_note text := E'\n[Migration] Auto-archived: duplicate identity (phone or email) — kept the primary active application.';
begin
  with dup_phone as (
    select phone1_digits
    from public.registrations
    where phone1_digits is not null
      and length(phone1_digits) >= 7
      and status not in ('rejected', 'archived')
    group by phone1_digits
    having count(*) > 1
  ),
  phone_ranked as (
    select r.id,
      row_number() over (
        partition by r.phone1_digits
        order by
          case r.status
            when 'accepted' then 0
            when 'in_progress' then 1
            when 'new' then 2
            else 3
          end,
          r.submitted_at asc nulls last,
          r.id asc
      ) as rn
    from public.registrations r
    inner join dup_phone d on d.phone1_digits = r.phone1_digits
    where r.status not in ('rejected', 'archived')
  )
  update public.registrations r
  set
    status = 'archived',
    notes = case
      when coalesce(trim(r.notes), '') = '' then trim(dup_note)
      else trim(r.notes) || dup_note
    end
  from phone_ranked p
  where r.id = p.id and p.rn > 1;

  with dup_email as (
    select email_normalized
    from public.registrations
    where email_normalized is not null
      and status not in ('rejected', 'archived')
    group by email_normalized
    having count(*) > 1
  ),
  email_ranked as (
    select r.id,
      row_number() over (
        partition by r.email_normalized
        order by
          case r.status
            when 'accepted' then 0
            when 'in_progress' then 1
            when 'new' then 2
            else 3
          end,
          r.submitted_at asc nulls last,
          r.id asc
      ) as rn
    from public.registrations r
    inner join dup_email d on d.email_normalized = r.email_normalized
    where r.status not in ('rejected', 'archived')
  )
  update public.registrations r
  set
    status = 'archived',
    notes = case
      when coalesce(trim(r.notes), '') = '' then trim(dup_note)
      else trim(r.notes) || dup_note
    end
  from email_ranked e
  where r.id = e.id and e.rn > 1;
end $$;

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
