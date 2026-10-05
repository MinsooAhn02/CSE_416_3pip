-- Calendar and health data are no longer cached server-side (device-local only). Remove existing rows.
-- Keys: calendar_today, calendar_<date>, health_default. With the "u:<uuid>:" prefix (39 chars) they are
-- always <= 64 chars, so hashed "h:" ids can never hold these keys; the two patterns below cover everything.
delete from public.api_cache
where id like 'u:%:calendar\_%' escape '\'
   or id like 'u:%:health\_%' escape '\';
