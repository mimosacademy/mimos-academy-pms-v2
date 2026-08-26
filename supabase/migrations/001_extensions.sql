-- MIMOS Academy PMS - Supabase migration
-- 001_extensions.sql
-- PostgreSQL/Supabase foundation. Safe to run once.

create extension if not exists pgcrypto;

create schema if not exists private;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Application roles are deliberately server-controlled. Do not use user-editable
-- raw_user_meta_data for authorization.
create or replace function public.current_staff_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(role_code, 'VIEWER')
  from public.staff
  where auth_user_id = (select auth.uid())
    and is_active = true
  limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_staff_role() in ('SUPER_ADMIN','ADMIN');
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_staff_role() in ('SUPER_ADMIN','ADMIN','STAFF','MANAGER','PIC','SALES','FINANCE','TRAINER','MASB_TEAM');
$$;

revoke all on function public.current_staff_role() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_staff() from public;
grant execute on function public.current_staff_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_staff() to authenticated;

-- Auth users are owned by Supabase Auth. Application profile data belongs in
-- public.staff and is linked through staff.auth_user_id.
