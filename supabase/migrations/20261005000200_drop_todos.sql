-- ============================================================
-- 사용하지 않는 todos 테이블 삭제 (BACKLOG R6)
-- 할 일은 Google Tasks + localStorage(mb_todos)로만 관리 — 이 테이블은 조회하는 코드가 없음.
-- 삭제 전 14행을 로컬에 백업함 (backups/todos-2026-10-05.json, 커밋 안 함).
-- Run in Supabase Dashboard > SQL Editor
-- ============================================================

drop table if exists public.todos;
