-- Import pipeline regression tests
DO $$
BEGIN
  IF to_regclass('intake.change_set') IS NULL THEN RAISE EXCEPTION 'change_set missing'; END IF;
  IF to_regclass('intake.change_set_item') IS NULL THEN RAISE EXCEPTION 'change_set_item missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='intake' AND p.proname='apply_change_set') THEN RAISE EXCEPTION 'promotion function missing'; END IF;
  IF has_function_privilege('authenticated','intake.apply_change_set(bigint)','EXECUTE') THEN RAISE EXCEPTION 'authenticated can execute promotion'; END IF;
  IF has_function_privilege('anon','intake.apply_change_set(bigint)','EXECUTE') THEN RAISE EXCEPTION 'anon can execute promotion'; END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='intake' AND tablename IN ('change_set','change_set_item') AND ('public'=ANY(roles) OR 'anon'=ANY(roles) OR 'authenticated'=ANY(roles))) THEN RAISE EXCEPTION 'public-facing intake policy detected'; END IF;
END $$;
