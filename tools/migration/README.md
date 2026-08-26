# PMS Excel → Supabase migration

## Source hierarchy

1. Original Excel workbook — external source of truth.
2. `readme/Excel to json/*.json` — machine-readable forensic extraction.
3. `readme/Excel to MD/*.md` — human/audit representation.
4. Supabase staging — controlled import copy.
5. Canonical tables — only validated records.

## Safety rules

- Never mutate source JSON/MD during migration.
- Never deduplicate source rows.
- Never convert blank, N/A, `-`, or zero into one another.
- Keep monetary values exact until validation succeeds.
- Preserve workbook, sheet and Excel row lineage.
- Do not infer primary/foreign keys without validation.
- Send ambiguous cross-source matches to `data_conflict`.
- Do not copy password/default-password/secret/token fields into application tables or logs.

## Utilities

`validate_source_json.py` validates extraction structure without changing source data.

`build_source_manifest.py <json-dir> --output source-manifest.json` builds a deterministic manifest and SHA-256 inventory.

`json_to_staging.py` loads extraction records into raw staging only; it does not commit canonical business records.

## Recommended execution

```text
validate JSON
  ↓
build manifest
  ↓
MD ↔ JSON reconciliation
  ↓
raw staging
  ↓
field/business-key mapping
  ↓
cross-source reconciliation
  ↓
data_conflict for ambiguity
  ↓
canonical commit
  ↓
R1/R2/R3/dashboard verification
```

## Live database execution

Use a server-side Postgres connection string in the runtime environment. Never commit it to GitHub and never put the service-role key in the Vite frontend.

The browser must use only the Supabase publishable/anon key with RLS enabled.
