-- Final static import pipeline security checks.
DO $$
DECLARE n integer;
BEGIN
  IF to_regclass('intake.change_set') IS NULL OR to_regclass('intake.change_set_item') IS NULL THEN
    RAISE EXCEPTION 'Import change-set schema incomplete';
  END IF;
  IF to_regclass('intake.field_mapping') IS NULL THEN RAISE EXCEPTION 'Field mapping missing'; END IF;
  IF to_regprocedure('intake.apply_change_set(bigint)') IS NULL THEN RAISE EXCEPTION 'Promotion function missing'; END IF;
  IF has_function_privilege('anon','intake.apply_change_set(bigint)','EXECUTE') OR has_function_privilege('authenticated','intake.apply_change_set(bigint)','EXECUTE') THEN
    RAISE EXCEPTION 'Untrusted role can execute privileged promotion';
  END IF;
  IF has_function_privilege('anon','private.apply_import_update(text,bigint,text,jsonb)','EXECUTE') OR has_function_privilege('authenticated','private.apply_import_update(text,bigint,text,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'Untrusted role can execute concurrency guard';
  END IF;
  SELECT count(*) INTO n FROM pg_policies WHERE schemaname='intake' AND tablename IN ('change_set','change_set_item','field_mapping') AND ('anon'=ANY(roles) OR 'authenticated'=ANY(roles));
  IF n>0 THEN RAISE EXCEPTION 'Public intake policies detected: %',n; END IF;
END $$;
