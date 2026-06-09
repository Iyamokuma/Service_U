-- Replace SMS with in-app push for announcements.

alter table public.announcements
  add column if not exists medium_push smallint not null default 0;

-- Legacy rows that used SMS are not migrated to push automatically.
