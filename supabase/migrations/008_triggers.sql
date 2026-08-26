-- 008_triggers.sql

create or replace function private.refresh_programme_financials(p_programme_id bigint)
returns void language plpgsql security definer set search_path=public as $$
begin
  if p_programme_id is null then return; end if;
  update public.programme p set total_revenue_excl_tax=coalesce((select sum(i.amount_excl_tax) from public.invoice i where i.programme_id=p.id and not i.is_cancelled and not i.is_placeholder),0), total_sst_amount=coalesce((select sum(i.sst_amount) from public.invoice i where i.programme_id=p.id and not i.is_cancelled and not i.is_placeholder),0), total_revenue_incl_tax=coalesce((select sum(i.total_incl_tax) from public.invoice i where i.programme_id=p.id and not i.is_cancelled and not i.is_placeholder),0), total_outstanding=coalesce((select sum(i.amount_outstanding) from public.invoice i where i.programme_id=p.id and not i.is_cancelled and not i.is_placeholder),0), total_collected=coalesce((select sum(py.amount) from public.payment py where py.programme_id=p.id and exists(select 1 from public.payment_status ps where ps.id=py.payment_status_id and ps.code='PAID')),0) where p.id=p_programme_id;
end; $$;

create or replace function private.trg_invoice_financials() returns trigger language plpgsql as $$ begin perform private.refresh_programme_financials(old.programme_id) where tg_op<>'INSERT' and old.programme_id is not null; perform private.refresh_programme_financials(new.programme_id) where new.programme_id is not null; return new; end; $$;
create or replace function private.trg_payment_financials() returns trigger language plpgsql as $$ begin perform private.refresh_programme_financials(old.programme_id) where tg_op<>'INSERT' and old.programme_id is not null; perform private.refresh_programme_financials(new.programme_id) where new.programme_id is not null; return new; end; $$;
create or replace function private.calc_invoice_days_outstanding() returns trigger language plpgsql as $$ begin if new.due_date is not null and not exists(select 1 from public.payment_status ps where ps.id=new.payment_status_id and ps.code='PAID') then new.days_outstanding:=current_date-new.due_date; else new.days_outstanding:=null; end if; return new; end; $$;
create or replace function private.calc_opportunity_weighted() returns trigger language plpgsql as $$ begin if new.forecast_value is not null and new.probability_percentage is not null then new.weighted_value:=round(new.forecast_value*(new.probability_percentage/100),2); end if; return new; end; $$;

create trigger trg_invoice_days_outstanding before insert or update on public.invoice for each row execute function private.calc_invoice_days_outstanding();
create trigger trg_invoice_financials after insert or update on public.invoice for each row execute function private.trg_invoice_financials();
create trigger trg_payment_financials after insert or update on public.payment for each row execute function private.trg_payment_financials();
create trigger trg_opportunity_weighted before insert or update on public.opportunity for each row execute function private.calc_opportunity_weighted();

do $$ declare r record; begin for r in select table_schema,table_name from information_schema.columns where table_schema='public' and column_name='updated_at' and table_name not like 'pg_%' loop execute format('drop trigger if exists trg_set_updated_at on %I.%I',r.table_schema,r.table_name); execute format('create trigger trg_set_updated_at before update on %I.%I for each row execute function private.set_updated_at()',r.table_schema,r.table_name); end loop; end $$;

-- Supabase Realtime: safely add required tables to the publication when hosted project defaults allow it.
do $$ declare t text; begin foreach t in array array['client','programme','opportunity','quotation','purchase_order','invoice','payment','action_item','training_stat','participant','training_delivery','document','audit_history'] loop if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t); end if; end loop; end $$;
