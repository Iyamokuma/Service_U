-- Branch / satellite targeting for announcements (country / state / site scoped posts).
alter table public.announcements add column if not exists scope_branch_state text not null default '';
alter table public.announcements add column if not exists scope_satellite_site text not null default '';
