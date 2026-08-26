-- 017_authorization_boundary_hardening.sql
-- Post-remediation authorization hardening.
-- Prevent self-service privilege escalation through staff/profile records,
-- remove legacy browser RPC surfaces, and keep staff.role_id as the
-- authoritative PMS authorization source.

create or replace function private.prevent_staff_security_field_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_admin() then
    return new;
  end if;

  if new.role_id is distinct from old.role_id
     or new.is_active is distinct from old.is_active
     or new.auth_user_id is distinct from old.auth_user_id
     or new.created_by is distinct from old.created_by then
    raise exception 'security-sensitive staff fields may only be changed by an administrator';
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_staff_security_field_escalation() from public, anon, authenticated;

drop trigger if exists trg_prevent_staff_security_field_escalation on public.staff;
create trigger trg_prevent_staff_security_field_escalation
before update on public.staff
for each row execute function private.prevent_staff_security_field_escalation();

create or replace function private.prevent_profile_security_field_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.staff_id is distinct from old.staff_id
     or new.is_active is distinct from old.is_active then
    raise exception 'security-sensitive profile fields may only be changed by an administrator';
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_profile_security_field_escalation() from public, anon, authenticated;

drop trigger if exists trg_prevent_profile_security_field_escalation on public.profiles;
create trigger trg_prevent_profile_security_field_escalation
before update on public.profiles
for each row execute function private.prevent_profile_security_field_escalation();

-- Keep this legacy helper aligned to the authoritative DB-backed PMS role.
create or replace function public.is_staff_or_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select private.is_pms_user()
$$;

revoke all on function public.is_staff_or_admin() from public, anon;
grant execute on function public.is_staff_or_admin() to authenticated;

-- These functions are internal/trigger helpers, not browser RPC endpoints.
revoke all on function public.fn_refresh_programme(bigint) from public, anon, authenticated;
revoke all on function public.fn_programme_completeness(bigint) from public, anon, authenticated;

-- Legacy public admin helper must not be callable by browser clients.
revoke all on function public.is_admin() from public, anon, authenticated;
