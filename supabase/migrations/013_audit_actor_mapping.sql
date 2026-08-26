-- 013_audit_actor_mapping.sql
-- Production-safe audit actor mapping.
-- created_by is the authoritative Supabase Auth UUID.
-- actor_id mirrors created_by for explicit audit semantics.
-- actor_name is a human-readable snapshot resolved from public.staff.

alter table public.audit_history
  add column if not exists actor_id uuid references auth.users(id) on delete set null;

create index if not exists idx_audit_history_actor_id
  on public.audit_history(actor_id);

create or replace function public.set_audit_actor_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_name text;
begin
  if new.actor_id is null then
    new.actor_id := new.created_by;
  end if;

  if new.created_by is null then
    new.created_by := new.actor_id;
  end if;

  if new.actor_id is not null then
    select nullif(trim(s.full_name), '')
      into resolved_name
    from public.staff s
    where s.auth_user_id = new.actor_id
    limit 1;

    if resolved_name is not null then
      new.actor_name := left(resolved_name, 100);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_audit_actor_snapshot on public.audit_history;

create trigger trg_audit_actor_snapshot
before insert or update of actor_id, created_by, actor_name
on public.audit_history
for each row
execute function public.set_audit_actor_snapshot();

update public.audit_history a
set actor_id = a.created_by
where a.actor_id is null
  and a.created_by is not null;

update public.audit_history a
set actor_name = left(s.full_name, 100)
from public.staff s
where a.actor_id = s.auth_user_id
  and nullif(trim(s.full_name), '') is not null;

comment on column public.audit_history.created_by is
  'Authoritative Supabase auth.users UUID for the actor that created the audit event.';

comment on column public.audit_history.actor_id is
  'Explicit audit actor UUID; normally identical to created_by.';

comment on column public.audit_history.actor_name is
  'Human-readable staff-name snapshot; never store a Supabase UUID here.';
