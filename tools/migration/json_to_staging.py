#!/usr/bin/env python3
"""Load forensic Excel->JSON extracts into Supabase staging only.

This script intentionally does NOT write canonical business tables. It creates
source_file/import_batch/stg_raw_record lineage and leaves validation_status=PENDING.
Requires DATABASE_URL (Supabase Postgres connection string) or equivalent psycopg DSN.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import psycopg
from psycopg.types.json import Jsonb

SECRET_HEADERS = {"defauls password", "default password", "password", "passwd", "password_hash"}


def scrub_for_staging(data: dict[str, Any]) -> dict[str, Any]:
    """Remove credential material from operational staging while preserving source JSON on disk."""
    out: dict[str, Any] = {}
    for key, value in data.items():
        if key.strip().lower() in SECRET_HEADERS:
            continue
        out[key] = value
    return out


def source_rows(doc: dict[str, Any]):
    for sheet in doc.get("sheets", []):
        for row in sheet.get("rows", []):
            values = {}
            for header, cell in row.get("cells", {}).items():
                # Keep source value/formula/type information; never clean it.
                values[header] = {
                    "value": cell.get("value"),
                    "formula": cell.get("formula"),
                    "data_type": cell.get("data_type"),
                    "is_empty": cell.get("is_empty"),
                    "excel_error": cell.get("excel_error"),
                }
            yield sheet.get("sheet_name"), row.get("source_row_number"), values


def guess_target(filename: str) -> str | None:
    name = filename.lower()
    if "quotation" in name:
        return "quotation"
    if "r1" in name or "invoice" in name:
        return "invoice"
    if "r2" in name or "training" in name:
        return "training_stat"
    if "r3" in name or "funnel" in name or "sales_report" in name:
        return "opportunity"
    if "office_funnel" in name:
        return "action_item"
    if "cost_of_sales" in name:
        return "invoice"
    if "user_profiles" in name:
        return "staff"
    return None


def load(folder: Path, dsn: str, commit: bool) -> None:
    files = sorted(folder.glob("*.json"))
    if not files:
        raise SystemExit(f"No JSON files in {folder}")

    run_code = "JSON-" + datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            for path in files:
                doc = json.loads(path.read_text(encoding="utf-8"))
                source_name = doc["extraction_metadata"]["source_filename"]
                target = guess_target(source_name)
                digest = hashlib.sha256(path.read_bytes()).hexdigest()
                size = path.stat().st_size

                cur.execute(
                    """insert into public.source_file
                       (file_name,file_path,file_hash,file_size_bytes,file_type,description)
                       values (%s,%s,%s,%s,%s,%s)
                       returning id""",
                    (source_name, str(path), digest, size, ".json",
                     "Forensic Excel extraction; canonical data not yet validated"),
                )
                source_file_id = cur.fetchone()[0]
                batch_code = f"{run_code}-{source_file_id}"
                total = sum(1 for _ in source_rows(doc))
                cur.execute(
                    """insert into public.import_batch
                       (batch_code,source_file_id,import_type,table_target,records_total,status,start_time,notes)
                       values (%s,%s,'JSON_EXTRACTION',%s,%s,'STAGED',now(),%s)
                       returning id""",
                    (batch_code, source_file_id, target or 'UNMAPPED', total,
                     'Loaded from Excel->JSON forensic extraction; credential fields excluded from staging.'),
                )
                batch_id = cur.fetchone()[0]

                inserted = 0
                for sheet_name, row_number, values in source_rows(doc):
                    safe_values = scrub_for_staging(values)
                    source_key = None
                    for candidate in ("Invoice No.", "Quotation No.", "quotation_no", "invoice_no", "No"):
                        if candidate in safe_values:
                            v = safe_values[candidate].get("value")
                            if v not in (None, ""):
                                source_key = str(v)[:255]
                                break
                    cur.execute(
                        """insert into public.stg_raw_record
                           (import_batch_id,source_file,source_sheet,source_row_number,
                            source_record_key,source_type,target_table,raw_data)
                           values (%s,%s,%s,%s,%s,'EXCEL_JSON',%s,%s)""",
                        (batch_id, source_name, sheet_name, row_number, source_key,
                         target, Jsonb(safe_values)),
                    )
                    inserted += 1
                cur.execute(
                    "update public.import_batch set records_total=%s,records_inserted=0,end_time=now() where id=%s",
                    (inserted, batch_id),
                )
                print(json.dumps({"file": source_name, "batch_id": batch_id, "rows": inserted, "target": target}))

        if commit:
            conn.commit()
            print(json.dumps({"mode": "COMMIT", "message": "JSON sources staged only; canonical tables untouched."}))
        else:
            conn.rollback()
            print(json.dumps({"mode": "DRY_RUN", "message": "Transaction rolled back; no data persisted."}))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("folder", type=Path)
    ap.add_argument("--dsn", default=os.environ.get("DATABASE_URL"))
    ap.add_argument("--commit", action="store_true")
    args = ap.parse_args()
    if not args.dsn:
        raise SystemExit("DATABASE_URL is required")
    load(args.folder, args.dsn, args.commit)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
