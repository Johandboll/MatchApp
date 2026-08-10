alter table public.profiles
  add column if not exists privacy_notice_version text,
  add column if not exists privacy_notice_seen_at timestamptz;
