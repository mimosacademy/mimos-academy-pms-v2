#!/usr/bin/env python3
"""Build a deterministic source manifest from Excel->JSON extraction files.

This utility is intentionally read-only with respect to source JSON. It does not
clean, deduplicate, or mutate business values. The manifest is the control-plane
input for the later staging/canonical migration.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

DATASET_TARGETS = {
    "R1_MIMOS_Academy_INCOME_STATEMENT_Extraction.json": ["invoice", "payment", "client"],
    "invoice_2026_Extraction.json": ["invoice", "payment", "client"],
    "cost_of_sales_2026_Extraction.json": ["invoice", "payment"],
    "R2_Overall_Report_2026_Extraction.json": ["training_stat", "participant", "programme"],
    "R3_Group_2026_Funnel_Tracker_Extraction.json": ["opportunity", "client", "programme"],
    "sales_report_2026-08-19_Extraction.json": ["opportunity", "client", "staff"],
    "office_funnel_2026-08-19_Extraction.json": ["action_item", "client", "programme"],
    "00_Quotation_Tracker_Extraction.json": ["quotation", "client", "programme"],
    "User_Profiles_Mapping_Extraction.json": ["staff", "auth.users"],
}

SENSITIVE_HEADERS = {"password", "default password", "defauls password", "passwd", "secret", "token"}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def get_rows(doc: dict[str, Any]):
    for sheet in doc.get("sheets", []):
        for row in sheet.get("rows", []):
            yield sheet, row


def sensitive_columns(doc: dict[str, Any]) -> list[str]:
    found: set[str] = set()
    for sheet in doc.get("sheets", []):
        for col in sheet.get("columns", []):
            header = str(col.get("original_header", "")).strip().lower()
            if header in SENSITIVE_HEADERS or any(x in header for x in SENSITIVE_HEADERS):
                found.add(str(col.get("original_header")))
    return sorted(found)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("source_dir", type=Path)
    parser.add_argument("--output", type=Path, default=Path("source-manifest.json"))
    args = parser.parse_args()

    files = sorted(args.source_dir.glob("*.json"))
    manifest: dict[str, Any] = {
        "manifest_version": "1.0",
        "source_of_truth": "Excel-to-JSON forensic extraction",
        "rules": {
            "mutate_source": False,
            "deduplicate": False,
            "normalize": False,
            "infer_keys": False,
            "sensitive_values_exported": False,
        },
        "datasets": [],
    }

    for path in files:
        if path.name == args.output.name:
            continue
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:
            manifest["datasets"].append({"file": path.name, "status": "INVALID_JSON", "error": str(exc)})
            continue

        sheets = doc.get("sheets", [])
        row_count = sum(len(s.get("rows", [])) for s in sheets)
        dataset = {
            "file": path.name,
            "sha256": sha256(path),
            "status": "OK",
            "source_filename": doc.get("extraction_metadata", {}).get("source_filename", path.name),
            "worksheet_count": len(sheets),
            "worksheet_names": [s.get("sheet_name") for s in sheets],
            "row_count": row_count,
            "targets": DATASET_TARGETS.get(path.name, []),
            "sensitive_columns": sensitive_columns(doc),
            "sheets": [
                {
                    "sheet_name": s.get("sheet_name"),
                    "sheet_index": s.get("sheet_index"),
                    "row_count": len(s.get("rows", [])),
                    "column_count": len(s.get("columns", [])),
                }
                for s in sheets
            ],
        }
        manifest["datasets"].append(dataset)

    manifest["dataset_count"] = len(manifest["datasets"])
    args.output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {args.output} ({len(manifest['datasets'])} datasets)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
