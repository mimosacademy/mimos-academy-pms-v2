-- 039_import_canonical_hash.sql
-- One canonical hashing algorithm for analysis/comparison/promotion.

create or replace function private.canonical_json_hash(p_row jsonb)
returns text
language sql
immutable
security invoker
set search_path = public, private
as $$
  select encode(digest((
    select jsonb_object_agg(k, v order by k)
    from jsonb_each(p_row) e(k,v)
    where k not in ('created_at','updated_at')
  )::text, 'sha256'), 'hex');
$$;

revoke all on function private.canonical_json_hash(jsonb) from public, anon, authenticated;
comment on function private.canonical_json_hash(jsonb) is 'Canonical SHA-256 hash shared by import analysis and server-side concurrency validation; volatile timestamps are excluded.';
