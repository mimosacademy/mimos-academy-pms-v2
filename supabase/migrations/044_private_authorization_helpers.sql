-- 044_private_authorization_helpers.sql
-- Reconcile the production authorization-helper dependency with the repository
-- migration chain. RLS uses private security-definer helpers; browser-facing
-- helpers are only caller-scoped compatibility wrappers.
--
-- IMPORTANT: this migration is part of the repository chain and is intentionally
-- self-contained: private.has_role() is created before any helper that depends
-- on it. Production already has an equivalent helper from the reconciliation
-- migrations, so this is safe as a forward repository-chain definition.

begin;

create schema if not exists private;

create or replace function private.current_staff_id()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select s.id
  from public.staff s
  where s.auth_user_id = (select auth.uid())
    and s.is_active = true
  limit 1
$$;

create or replace function private.current_staff_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select upper(r.code)
  from public.staff s
  join public.staff_role r on r.id = s.role_id
  where s.auth_user_id = (select auth.uid())
    and s.is_active = true
    and r.is_active = true
  limit 1
$$;

create or replace function private.has_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff s
    join public.staff_role r on r.id = s.role_id
    where s.auth_user_id = (select auth.uid())
      and s.is_active = true
      and r.is_active = true
      and upper(r.code) = any (
        select upper(btrim(x))
        from unnest(coalesce(p_roles, '{}'::text[])) x
        where nullif(btrim(x), '') is not null
      )
  )
$$;

create or replace function private.is_pms_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role(
    array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE','SALES','MASB_TEAM','PIC','TRAINER','VIEWER']
  )
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role(array['SUPER_ADMIN','ADMIN'])
$$;

create or replace function private.has_pms_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role(p_roles)
$$;

create or replace function private.can_access_programme(p_programme_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.programme p
    where p.id = p_programme_id
      and (
        private.has_role(array['SUPER_ADMIN','ADMIN','MANAGER','VIEWER','FINANCE','SALES','MASB_TEAM'])
        or (private.has_role(array['PIC','TRAINER']) and p.pic_id = private.current_staff_id())
      )
  )
$$;

revoke all on function private.current_staff_id() from public, anon, authenticated;
revoke all on function private.current_staff_role() from public, anon, authenticated;
revoke all on function private.has_role(text[]) from public, anon, authenticated;
revoke all on function private.is_pms_user() from public, anon, authenticated;
revoke all on function private.is_admin() from public, anon, authenticated;
revoke all on function private.has_pms_role(text[]) from public, anon, authenticated;
revoke all on function private.can_access_programme(bigint) from public, anon, authenticated;

grant usage on schema private to authenticated;
grant execute on function private.current_staff_id() to authenticated;
grant execute on function private.current_staff_role() to authenticated;
grant execute on function private.has_role(text[]) to authenticated;
grant execute on function private.is_pms_user() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.has_pms_role(text[]) to authenticated;
grant execute on function private.can_access_programme(bigint) to authenticated;

-- Public compatibility helpers are deliberately SECURITY INVOKER. They never
-- execute with owner rights; the actual authorization logic remains private.
create or replace function public.current_staff_id()
returns bigint
language sql
stable
security invoker
set search_path = public, private
as $$ select private.current_staff_id() $$;

create or replace function public.current_staff_role()
returns text
language sql
stable
security invoker
set search_path = public, private
as $$ select private.current_staff_role() $$;

create or replace function public.has_pms_role(p_roles text[])
returns boolean
language sql
stable
security invoker
set search_path = public, private
as $$ select private.has_pms_role(p_roles) $$;

create or replace function public.can_access_programme(p_programme_id bigint)
returns boolean
language sql
stable
security invoker
set search_path = public, private
as $$ select private.can_access_programme(p_programme_id) $$;

revoke all on function public.current_staff_id() from public, anon;
revoke all on function public.current_staff_role() from public, anon;
revoke all on function public.has_pms_role(text[]) from public, anon;
revoke all on function public.can_access_programme(bigint) from public, anon;
grant execute on function public.current_staff_id() to authenticated;
grant execute on function public.current_staff_role() to authenticated;
grant execute on function public.has_pms_role(text[]) to authenticated;
grant execute on function public.can_access_programme(bigint) to authenticated;

commit;
