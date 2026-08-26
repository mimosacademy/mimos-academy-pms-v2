-- 020_private_authorization_execution.sql
-- RLS policies execute private authorization helpers on behalf of the
-- authenticated application role. The private schema remains outside the
-- browser API surface; authenticated needs only schema usage and execute.

begin;

grant usage on schema private to authenticated;
grant execute on function private.current_staff_id() to authenticated;
grant execute on function private.current_staff_role() to authenticated;
grant execute on function private.has_pms_role(text[]) to authenticated;
grant execute on function private.can_access_programme(bigint) to authenticated;

commit;
