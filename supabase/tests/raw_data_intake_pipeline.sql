-- Raw-data intake security regression checks.
do $$
begin
  if to_regclass('intake.batch') is null then raise exception 'intake.batch missing'; end if;
  if to_regclass('intake.record') is null then raise exception 'intake.record missing'; end if;
  if to_regclass('intake.review') is null then raise exception 'intake.review missing'; end if;
  if not exists (select 1 from pg_indexes where schemaname='intake' and indexname='ux_intake_batch_file_hash') then raise exception 'file fingerprint uniqueness missing'; end if;
  if not exists (select 1 from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname='intake' and t.relname='record' and c.contype='u') then raise exception 'row idempotency constraint missing'; end if;
  if not exists (select 1 from pg_class t join pg_namespace n on n.oid=t.relnamespace where n.nspname='intake' and t.relname='batch' and t.relrowsecurity) then raise exception 'batch RLS missing'; end if;
  if not exists (select 1 from pg_class t join pg_namespace n on n.oid=t.relnamespace where n.nspname='intake' and t.relname='record' and t.relrowsecurity) then raise exception 'record RLS missing'; end if;
end $$;
