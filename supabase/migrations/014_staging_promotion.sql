-- 014_staging_promotion.sql
-- Canonical promotion is deliberately opt-in: only VALID/READY/APPROVED rows are eligible.
-- Mapping must be completed by the migration engine before calling these functions.

CREATE OR REPLACE FUNCTION public.promote_stg_invoice(p_batch_id bigint)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE r record; inserted_count integer := 0;
BEGIN
  FOR r IN
    SELECT * FROM public.stg_invoice
    WHERE import_batch_id=p_batch_id
      AND validation_status IN ('VALID','READY','APPROVED')
      AND mapped_client_id IS NOT NULL
      AND mapped_programme_id IS NOT NULL
      AND mapped_invoice_id IS NULL
    ORDER BY id
  LOOP
    INSERT INTO public.invoice (
      invoice_no, programme_id, client_id, invoice_date, due_date,
      amount_excl_tax, sst_amount, total_incl_tax, amount_collected,
      amount_outstanding, days_outstanding, quotation_no_ref, po_no_ref,
      source_file, source_row_number, import_batch_id, created_by, updated_by
    ) VALUES (
      NULLIF(trim(r.raw_invoice_no),''), r.mapped_programme_id, r.mapped_client_id,
      NULLIF(r.raw_invoice_date,'')::date, NULLIF(r.raw_due_date,'')::date,
      NULLIF(regexp_replace(coalesce(r.raw_invoice_value,''),'[^0-9.\-]','','g'),'')::numeric(18,2),
      NULLIF(regexp_replace(coalesce(r.raw_sst_amount,''),'[^0-9.\-]','','g'),'')::numeric(18,2),
      NULLIF(regexp_replace(coalesce(r.raw_total_value,''),'[^0-9.\-]','','g'),'')::numeric(18,2),
      coalesce(NULLIF(regexp_replace(coalesce(r.raw_amount_collected,''),'[^0-9.\-]','','g'),'')::numeric(18,2),0),
      coalesce(NULLIF(regexp_replace(coalesce(r.raw_total_value,''),'[^0-9.\-]','','g'),'')::numeric(18,2),0)
        - coalesce(NULLIF(regexp_replace(coalesce(r.raw_amount_collected,''),'[^0-9.\-]','','g'),'')::numeric(18,2),0),
      NULLIF(r.raw_days_outstanding,'')::integer, NULLIF(r.raw_quotation_no,''), NULLIF(r.raw_po_no,''),
      r.source_file, r.source_row_number, p_batch_id, auth.uid(), auth.uid()
    );
    inserted_count := inserted_count + 1;
  END LOOP;
  UPDATE public.import_batch SET records_inserted=records_inserted+inserted_count, updated_at=now() WHERE id=p_batch_id;
  RETURN jsonb_build_object('batch_id',p_batch_id,'table','invoice','inserted',inserted_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.promote_stg_quotation(p_batch_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN SELECT * FROM public.stg_quotation WHERE import_batch_id=p_batch_id AND validation_status IN ('VALID','READY','APPROVED') AND mapped_client_id IS NOT NULL AND mapped_quotation_id IS NULL ORDER BY id LOOP
    INSERT INTO public.quotation(quotation_no,client_id,programme_id,project_title,duration_days,no_of_unit,unit_price_excl_tax,unit_price_incl_tax,total_price_excl_tax,total_price_incl_tax,sst_amount,discount_percentage,final_price,quotation_date,valid_until,pic_full_name,pic_contact_no,pic_email,source_file,source_row_number,import_batch_id,created_by,updated_by)
    VALUES(NULLIF(trim(r.raw_quotation_no),''),r.mapped_client_id,r.mapped_programme_id,r.raw_project_title,
      NULLIF(r.raw_duration_days,'')::numeric(5,2),NULLIF(r.raw_no_of_unit,'')::integer,
      NULLIF(regexp_replace(coalesce(r.raw_unit_price_excl,''),'[^0-9.\-]','','g'),'')::numeric(15,4),
      NULLIF(regexp_replace(coalesce(r.raw_unit_price_incl,''),'[^0-9.\-]','','g'),'')::numeric(15,4),
      NULLIF(regexp_replace(coalesce(r.raw_total_price_excl,''),'[^0-9.\-]','','g'),'')::numeric(18,2),
      NULLIF(regexp_replace(coalesce(r.raw_total_price_incl,''),'[^0-9.\-]','','g'),'')::numeric(18,2),
      NULLIF(regexp_replace(coalesce(r.raw_sst_amount,''),'[^0-9.\-]','','g'),'')::numeric(18,2),
      NULLIF(regexp_replace(coalesce(r.raw_discount_pct,''),'[^0-9.\-]','','g'),'')::numeric(5,2),
      NULLIF(regexp_replace(coalesce(r.raw_final_price,''),'[^0-9.\-]','','g'),'')::numeric(18,2),
      NULLIF(r.raw_date,'')::date,NULLIF(r.raw_date,'')::date,r.raw_pic_full_name,r.raw_pic_contact,r.raw_pic_email,r.source_file,r.source_row_number,p_batch_id,auth.uid(),auth.uid());
    n:=n+1;
  END LOOP;
  UPDATE public.import_batch SET records_inserted=records_inserted+n,updated_at=now() WHERE id=p_batch_id;
  RETURN jsonb_build_object('batch_id',p_batch_id,'table','quotation','inserted',n);
END;$$;

CREATE OR REPLACE FUNCTION public.promote_stg_funnel(p_batch_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; n integer:=0;
BEGIN
  FOR r IN SELECT * FROM public.stg_funnel WHERE import_batch_id=p_batch_id AND validation_status IN ('VALID','READY','APPROVED') AND mapped_client_id IS NOT NULL AND mapped_opportunity_id IS NULL ORDER BY id LOOP
    INSERT INTO public.opportunity(client_id,programme_id,project_title,forecast_value,probability_percentage,weighted_value,secured_value,remarks,source_file,source_row_number,import_batch_id,created_by,updated_by)
    VALUES(r.mapped_client_id,r.mapped_programme_id,r.raw_project,
      NULLIF(regexp_replace(coalesce(r.raw_forecast_value,''),'[^0-9.\-]','','g'),'')::numeric(18,2),
      NULLIF(regexp_replace(coalesce(r.raw_probability,''),'[^0-9.\-]','','g'),'')::numeric(5,2),
      NULLIF(regexp_replace(coalesce(r.raw_weighted_value,''),'[^0-9.\-]','','g'),'')::numeric(18,2),
      NULLIF(regexp_replace(coalesce(r.raw_secured_value,''),'[^0-9.\-]','','g'),'')::numeric(18,2),r.raw_remarks,r.source_file,r.source_row_number,p_batch_id,auth.uid(),auth.uid());
    n:=n+1;
  END LOOP;
  UPDATE public.import_batch SET records_inserted=records_inserted+n,updated_at=now() WHERE id=p_batch_id;
  RETURN jsonb_build_object('batch_id',p_batch_id,'table','opportunity','inserted',n);
END;$$;

REVOKE ALL ON FUNCTION public.promote_stg_invoice(bigint) FROM public;
REVOKE ALL ON FUNCTION public.promote_stg_quotation(bigint) FROM public;
REVOKE ALL ON FUNCTION public.promote_stg_funnel(bigint) FROM public;
GRANT EXECUTE ON FUNCTION public.promote_stg_invoice(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_stg_quotation(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_stg_funnel(bigint) TO authenticated;
