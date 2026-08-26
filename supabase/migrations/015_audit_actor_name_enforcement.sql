-- 015_audit_actor_name_enforcement.sql
-- Keep audit_history.actor_name human-readable while actor_id/created_by hold auth UUIDs.

create or replace function public.set_audit_actor_identity()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  resolved_actor uuid;
  resolved_name text;
begin
  resolved_actor := coalesce(new.actor_id, new.created_by, auth.uid());

  if new.actor_id is null and resolved_actor is not null then
    new.actor_id := resolved_actor;
  end if;

  if new.created_by is null and resolved_actor is not null then
    new.created_by := resolved_actor;
  end if;

  if resolved_actor is not null then
    select s.full_name
      into resolved_name
      from public.staff s
     where s.auth_user_id = resolved_actor
       and s.is_active = true
     limit 1;

    if resolved_name is not null and btrim(resolved_name) <> '' then
      new.actor_name := resolved_name;
    end if;
  end if;

  if new.actor_name is not null
     and btrim(new.actor_name) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     and resolved_name is null then
    new.actor_name := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_audit_history_actor_identity on public.audit_history;
create trigger trg_audit_history_actor_identity
before insert or update on public.audit_history
for each row
execute function public.set_audit_actor_identity();

update public.audit_history ah
set actor_id = coalesce(ah.actor_id, ah.created_by),
    created_by = coalesce(ah.created_by, ah.actor_id),
    actor_name = coalesce(
      nullif(btrim(s.full_name), ''),
      case
        when ah.actor_name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then null
        else nullif(btrim(ah.actor_name), '')
      end
    )
from public.staff s
where s.auth_user_id = coalesce(ah.actor_id, ah.created_by);

update public.audit_history ah
set actor_name = null
where ah.actor_name is not null
  and btrim(ah.actor_name) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
