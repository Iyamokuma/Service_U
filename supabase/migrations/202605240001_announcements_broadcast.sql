-- Broadcast announcements: destination, medium, workflow (draft / scheduled / sent / archived).

alter table public.announcements add column if not exists workflow_status text not null default 'sent';
alter table public.announcements add column if not exists destination_type text not null default 'admins';
alter table public.announcements add column if not exists destination_config jsonb not null default '{}'::jsonb;
alter table public.announcements add column if not exists medium_email smallint not null default 0;
alter table public.announcements add column if not exists medium_sms smallint not null default 0;
alter table public.announcements add column if not exists scheduled_at timestamptz;
alter table public.announcements add column if not exists sent_at timestamptz;
alter table public.announcements add column if not exists archived_at timestamptz;

update public.announcements
set
  workflow_status = 'sent',
  sent_at = coalesce(sent_at, created_at)
where workflow_status is null or workflow_status = '';

create index if not exists idx_announcements_workflow on public.announcements (workflow_status, scheduled_at);
