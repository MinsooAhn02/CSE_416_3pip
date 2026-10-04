-- ============================================================
-- Fixed onboarding interests
-- Keeps onboarding-selected interests on the user account so
-- they can be restored across devices and merged with dynamic
-- diary/Q&A interests.
-- ============================================================

alter table public.user_settings
  add column if not exists fixed_interests jsonb default '[]';

alter table public.user_settings
  add column if not exists onboarding_perms jsonb default '{"fit": false, "cal": false}';
