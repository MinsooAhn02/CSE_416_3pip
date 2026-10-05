-- 일기 종단간 암호화 설정 (BACKLOG I5)
-- { v, salt, iterations, verifier } — 키 생성용 salt와 비밀번호 확인용 암호문만 저장.
-- 비밀번호·키는 서버에 저장하지 않음 (src/lib/diaryCrypto.ts). null = 암호화 꺼짐.
-- 기존 RLS(본인 행만)와 authenticated 권한이 그대로 적용됨.
alter table public.user_settings add column if not exists diary_encryption jsonb;
