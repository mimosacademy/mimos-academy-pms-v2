-- 039_quotation_state_transition_role_fix.sql
-- Correct the role-helper invocation in the quotation state-transition trigger.
-- private.has_pms_role expects text[], not text.

begin;

create or replace function private.enforce_quotation_state_transition()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if old.status_id is distinct from new.status_id
     and private.has_pms_role(array['SUPER_ADMIN']) = false then
    if exists (
      select 1
      from public.quotation_status s_old
      join public.quotation_status s_new on true
      where s_old.id = old.status_id
        and s_new.id = new.status_id
        and upper(s_old.code) = 'ACCEPTED'
        and upper(s_new.code) <> 'ACCEPTED'
    ) then
      raise exception 'Accepted quotation cannot transition to another state';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_quotation_state_transition() from public, anon, authenticated;

commit;
