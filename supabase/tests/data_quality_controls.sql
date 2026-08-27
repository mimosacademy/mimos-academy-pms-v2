-- Data quality/control-plane regression checks.
do $$
begin
  if to_regclass('intake.change_ledger') is null then raise exception 'change ledger missing'; end if;
  if to_regclass('governance.programme_completeness') is null then raise exception 'programme completeness table missing'; end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='governance' and p.proname='calculate_programme_completeness') then raise exception 'completeness function missing'; end if;
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='governance' and c.relname='programme_completeness' and c.relrowsecurity) then raise exception 'completeness RLS missing'; end if;
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='intake' and c.relname='change_ledger' and c.relrowsecurity) then raise exception 'change ledger RLS missing'; end if;
end $$;
