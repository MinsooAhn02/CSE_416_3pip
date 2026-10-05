-- ============================================================
-- user_qa / briefing_snapshots: UPDATE own rows.
-- Needed to re-encrypt / decrypt existing rows in place when the user turns
-- end-to-end diary encryption on or off (useDiaryStore). Grants already include UPDATE.
-- ============================================================

drop policy if exists "Users can update own qa" on public.user_qa;
create policy "Users can update own qa"
  on public.user_qa for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can update own snapshots" on public.briefing_snapshots;
create policy "Users can update own snapshots"
  on public.briefing_snapshots for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
