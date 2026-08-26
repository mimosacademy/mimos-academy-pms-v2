-- 010_views.sql

create or replace view public.v_r1_income_statement as
select i.id invoice_id,i.invoice_no,i.invoice_date,i.due_date,i.days_outstanding,p.id programme_id,p.programme_code,p.title programme_title,c.id client_id,c.company_name client_name,a.code account_code,a.name account_name,rt.code revenue_type_code,rt.name revenue_type_name,i.amount_excl_tax,i.sst_amount,i.sst_rate,i.total_incl_tax,i.amount_collected,i.amount_outstanding,ps.code payment_status_code,ps.name payment_status_name,i.payment_date,pm.code payment_method_code,pm.name payment_method_name,pt.code payment_terms_code,pt.name payment_terms_name,i.quotation_no_ref,i.po_no_ref,i.training_start_date,i.training_end_date,am.full_name account_manager,pic.full_name pic_name,i.is_placeholder,i.is_cancelled,i.source_file,i.source_row_number
from public.invoice i left join public.programme p on p.id=i.programme_id left join public.client c on c.id=i.client_id left join public.account a on a.id=i.account_id left join public.revenue_type rt on rt.id=i.revenue_type_id left join public.payment_status ps on ps.id=i.payment_status_id left join public.payment_method pm on pm.id=i.payment_method_id left join public.payment_terms pt on pt.id=i.payment_terms_id left join public.staff am on am.id=p.account_manager_id left join public.staff pic on pic.id=p.pic_id where not i.is_cancelled;

create or replace view public.v_r2_training_stats as
select p.id programme_id,p.programme_code,p.title programme_title,c.company_name client_name,tt.name training_type_name,pc.name programme_category_name,p.start_date,p.end_date,p.duration_days,p.no_of_pax,ts.training_date,ts.training_name,ts.company_name training_company,ts.training_category,ts.domain_code,ts.domain_name,ts.workshop_count,ts.training_count,ts.total_count,ts.bumiputera_count,ts.non_bumiputera_count,ts.total_charges_excl_tax,ts.sst_amount training_sst,ts.final_charges_incl_tax,p.total_revenue_excl_tax,p.total_sst_amount,p.total_revenue_incl_tax,p.total_collected,p.total_outstanding,ps.name programme_status_name,am.full_name account_manager,pic.full_name pic_name
from public.programme p left join public.client c on c.id=p.client_id left join public.training_type tt on tt.id=p.training_type_id left join public.programme_category pc on pc.id=p.programme_category_id left join public.programme_status ps on ps.id=p.programme_status_id left join public.staff am on am.id=p.account_manager_id left join public.staff pic on pic.id=p.pic_id left join public.training_stat ts on ts.programme_id=p.id;

create or replace view public.v_r3_funnel_pipeline as
select o.id opportunity_id,o.opportunity_code,c.company_name client_name,o.project_title,o.project_description,o.opportunity_type,os.name opportunity_status,os.code opportunity_status_code,stm.name speed_to_market,stm.quarter,stm.year,s.name sector_name,o.forecast_value,o.probability_percentage,o.weighted_value,o.secured_value,o.currency,o.expected_close_date,o.actual_close_date,o.po_date,o.po_value,o.is_government,o.is_private,o.is_interco,o.remarks,o.sector_remarks,am.full_name account_manager,sm.full_name salesman,p.id programme_id,p.programme_code linked_programme,o.source_file,o.source_row_number
from public.opportunity o left join public.client c on c.id=o.client_id left join public.opportunity_status os on os.id=o.opportunity_status_id left join public.speed_to_market stm on stm.id=o.speed_to_market_id left join public.sector s on s.id=o.sector_id left join public.staff am on am.id=o.account_manager_id left join public.staff sm on sm.id=o.salesman_id left join public.programme p on p.id=o.programme_id;

create or replace view public.v_programme_completeness as
select p.id programme_id,p.programme_code,p.title,c.company_name client_name,ps.name programme_status,cs.quotation_score,cs.po_score,cs.invoice_score,cs.payment_score,cs.delivery_score,cs.participant_score,cs.charges_score,cs.pic_score,cs.overall_score,cs.overall_status,cs.missing_components,cs.na_components,cs.evaluated_at,p.total_revenue_excl_tax,p.total_revenue_incl_tax,p.total_collected,p.total_outstanding,p.start_date,p.end_date,p.duration_days,p.no_of_pax,am.full_name account_manager,pic.full_name pic_name
from public.programme p left join public.client c on c.id=p.client_id left join public.programme_status ps on ps.id=p.programme_status_id left join public.completeness_score cs on cs.programme_id=p.id left join public.staff am on am.id=p.account_manager_id left join public.staff pic on pic.id=p.pic_id;

create or replace view public.v_financial_dashboard as
select 'REVENUE' metric_category,'Total Revenue (excl SST)' metric_name,coalesce(sum(amount_excl_tax),0) metric_value,count(*) record_count from public.invoice where not is_cancelled and not is_placeholder
union all select 'REVENUE','Total Revenue (incl SST)',coalesce(sum(total_incl_tax),0),count(*) from public.invoice where not is_cancelled and not is_placeholder
union all select 'COLLECTION','Total Collected',coalesce(sum(amount_collected),0),count(*) from public.invoice where not is_cancelled and not is_placeholder
union all select 'COLLECTION','Total Outstanding',coalesce(sum(amount_outstanding),0),count(*) from public.invoice where not is_cancelled and not is_placeholder
union all select 'OVERDUE','Overdue Amount',coalesce(sum(amount_outstanding),0),count(*) from public.invoice i where not is_cancelled and not is_placeholder and exists(select 1 from public.payment_status ps where ps.id=i.payment_status_id and ps.code='UNPAID') and days_outstanding>0
union all select 'FUNNEL','Total Forecast Value',coalesce(sum(forecast_value),0),count(*) from public.opportunity
union all select 'FUNNEL','Total Weighted Forecast',coalesce(sum(weighted_value),0),count(*) from public.opportunity
union all select 'FUNNEL','Total Secured Value',coalesce(sum(secured_value),0),count(*) from public.opportunity o where exists(select 1 from public.opportunity_status os where os.id=o.opportunity_status_id and os.code='CONTRACT_SIGNED');

create or replace view public.v_action_item_dashboard as
select ai.id action_item_id,ai.action_item_code,c.company_name client_name,p.title programme_title,o.project_title opportunity_title,ai.service,ai.action_description,ai.person_in_charge,ai.person_email,ai.due_date,ai.completed_date,ai.aging_days,ai.priority,ais.name status_name,ais.code status_code,ai.potential_revenue,ai.currency,ai.notes,st.full_name assigned_to,ai.created_at,ai.updated_at
from public.action_item ai left join public.client c on c.id=ai.client_id left join public.programme p on p.id=ai.programme_id left join public.opportunity o on o.id=ai.opportunity_id left join public.action_item_status ais on ais.id=ai.action_item_status_id left join public.staff st on st.id=ai.assigned_to_id;

create or replace view public.v_payment_collection as
select py.id payment_id,py.payment_reference,i.invoice_no,i.invoice_date,prog.id programme_id,prog.title programme_title,c.company_name client_name,py.payment_date,py.amount,py.sst_amount,py.total_amount,py.currency,py.amount_allocated,py.amount_unallocated,pm.name payment_method,ps.name payment_status,rb.full_name received_by,py.bank_reference,py.cheque_no,py.transaction_id,py.notes
from public.payment py left join public.invoice i on i.id=py.invoice_id left join public.programme prog on prog.id=py.programme_id left join public.client c on c.id=py.client_id left join public.payment_method pm on pm.id=py.payment_method_id left join public.payment_status ps on ps.id=py.payment_status_id left join public.staff rb on rb.id=py.received_by_id;

-- Corrected version of the source Staff Performance view. Separate aggregates prevent
-- multiplicative over-counting caused by joining four child tables simultaneously.
create or replace view public.v_staff_performance as
select s.id staff_id,s.full_name,s.email,sr.name role_name,
  coalesce((select count(*) from public.programme p where p.account_manager_id=s.id),0) programmes_managed,
  coalesce((select count(*) from public.quotation q where q.account_manager_id=s.id),0) quotations_prepared,
  coalesce((select count(*) from public.opportunity o where o.account_manager_id=s.id),0) opportunities_owned,
  coalesce((select count(*) from public.action_item ai where ai.assigned_to_id=s.id),0) action_items_assigned,
  coalesce((select sum(p.total_revenue_excl_tax) from public.programme p where p.account_manager_id=s.id),0) total_revenue_managed,
  coalesce((select sum(p.total_collected) from public.programme p where p.account_manager_id=s.id),0) total_collected_managed
from public.staff s left join public.staff_role sr on sr.id=s.role_id where s.is_active;

create or replace function public.sp_export_r1() returns setof public.v_r1_income_statement language sql stable as $$ select * from public.v_r1_income_statement $$;
create or replace function public.sp_export_r2() returns setof public.v_r2_training_stats language sql stable as $$ select * from public.v_r2_training_stats $$;
create or replace function public.sp_export_r3() returns setof public.v_r3_funnel_pipeline language sql stable as $$ select * from public.v_r3_funnel_pipeline $$;
