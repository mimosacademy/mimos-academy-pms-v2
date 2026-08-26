-- 013_role_rls_hardening.sql
-- Viewer: read operational data only.
-- Staff/PIC/etc: read + create/update operational data.
-- Admin: full operational write/delete and staff administration.
-- Staging, audit and conflict data are restricted to staff/admin.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'account_type','staff_role','sector','training_type','payment_method','payment_status','quotation_type','quotation_status','programme_status','project_status','opportunity_status','action_item_status','payment_terms','speed_to_market','programme_category','service_type','revenue_type',
    'account','client','client_contact','programme','quotation','purchase_order','invoice','payment','invoice_payment_allocation','opportunity','action_item','training_stat','participant','training_delivery','document','audit_history'
  ] LOOP
    EXECUTE format('drop policy if exists pms_select on public.%I',t);
    EXECUTE format('drop policy if exists pms_insert on public.%I',t);
    EXECUTE format('drop policy if exists pms_update on public.%I',t);
    EXECUTE format('drop policy if exists pms_delete on public.%I',t);
    EXECUTE format('create policy pms_select on public.%I for select to authenticated using (true)',t);
    EXECUTE format('create policy pms_insert on public.%I for insert to authenticated with check (public.is_staff())',t);
    EXECUTE format('create policy pms_update on public.%I for update to authenticated using (public.is_staff()) with check (public.is_staff())',t);
    EXECUTE format('create policy pms_delete on public.%I for delete to authenticated using (public.is_admin())',t);
  END LOOP;
END $$;

-- Staff identity is never self-administered.
DROP POLICY IF EXISTS pms_select ON public.staff;
DROP POLICY IF EXISTS pms_insert ON public.staff;
DROP POLICY IF EXISTS pms_update ON public.staff;
DROP POLICY IF EXISTS pms_delete ON public.staff;
CREATE POLICY pms_select ON public.staff FOR SELECT TO authenticated USING (true);
CREATE POLICY pms_insert ON public.staff FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY pms_update ON public.staff FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY pms_delete ON public.staff FOR DELETE TO authenticated USING (public.is_admin());

-- Sensitive migration/control-plane tables: staff/admin only.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['source_file','import_batch','stg_raw_record','stg_invoice','stg_quotation','stg_funnel','stg_action_item','stg_training_stat','stg_cost_of_sales','audit_log','data_conflict','completeness_score','staff_alias','client_alias'] LOOP
    EXECUTE format('drop policy if exists pms_select on public.%I',t);
    EXECUTE format('drop policy if exists pms_insert on public.%I',t);
    EXECUTE format('drop policy if exists pms_update on public.%I',t);
    EXECUTE format('drop policy if exists pms_delete on public.%I',t);
    EXECUTE format('create policy pms_select on public.%I for select to authenticated using (public.is_staff())',t);
    EXECUTE format('create policy pms_insert on public.%I for insert to authenticated with check (public.is_staff())',t);
    EXECUTE format('create policy pms_update on public.%I for update to authenticated using (public.is_staff()) with check (public.is_staff())',t);
    EXECUTE format('create policy pms_delete on public.%I for delete to authenticated using (public.is_admin())',t);
  END LOOP;
END $$;

-- Explicit role helper for frontend/edge functions.
CREATE OR REPLACE FUNCTION public.has_pms_role(p_roles text[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$
  SELECT upper(public.current_staff_role()) = ANY (
    SELECT upper(x) FROM unnest(coalesce(p_roles, ARRAY[]::text[])) AS x
  );
$$;
REVOKE ALL ON FUNCTION public.has_pms_role(text[]) FROM public;
GRANT EXECUTE ON FUNCTION public.has_pms_role(text[]) TO authenticated;
