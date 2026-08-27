-- 042_import_hash_alignment.sql
-- Corrects the 041 promotion engine so UPDATE concurrency checks use the
-- same canonical SHA-256 algorithm defined by private.canonical_json_hash().
-- The original 041 implementation hashed current_row::text directly, which
-- includes volatile created_at/updated_at fields and can disagree with the
-- comparison-stage hash.

DO $$
DECLARE
  fn text;
  old_fragment text := 'current_hash := encode(digest(current_row::text,''sha256''),''hex'');';
  new_fragment text := 'current_hash := private.canonical_json_hash(current_row);';
BEGIN
  SELECT pg_get_functiondef('intake.apply_change_set(bigint)'::regprocedure) INTO fn;

  IF position(old_fragment IN fn) = 0 THEN
    -- Idempotent: if 041 has already been corrected, leave it unchanged.
    IF position(new_fragment IN fn) > 0 THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'Expected 041 concurrency hash expression was not found';
  END IF;

  fn := replace(fn, old_fragment, new_fragment);
  EXECUTE fn;
END
$$;

REVOKE ALL ON FUNCTION intake.apply_change_set(bigint) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION intake.apply_change_set(bigint) TO service_role;

COMMENT ON FUNCTION intake.apply_change_set(bigint) IS
'Privileged import promotion with canonical SHA-256 concurrency validation, mapping-driven canonicalization, required-field validation, duplicate guards and authorized approval boundary.';
