#!/usr/bin/env python3
"""Cross-source reconciliation planner.

This tool never mutates source JSON and never commits canonical business data.
It identifies candidate business-key collisions using conservative exact-match
rules and emits a reviewable conflict/reconciliation report.
"""
from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
from typing import Any

DATASETS = {
    "R1_MIMOS_Academy_INCOME_STATEMENT_Extraction.json": "financial_r1",
    "invoice_2026_Extraction.json": "invoice_snapshot",
    "cost_of_sales_2026_Extraction.json": "cost_snapshot",
    "R2_Overall_Report_2026_Extraction.json": "training_r2",
    "R3_Group_2026_Funnel_Tracker_Extraction.json": "funnel_r3",
    "sales_report_2026-08-19_Extraction.json": "sales_snapshot",
    "office_funnel_2026-08-19_Extraction.json": "office_actions",
    "00_Quotation_Tracker_Extraction.json": "quotations",
    "User_Profiles_Mapping_Extraction.json": "staff_mapping",
}

KEY_ALIASES = {
    "invoice": ["Invoice No.", "Invoice No", "Invoice Number", "Invoice #"],
    "quotation": ["Quotation No.", "Quotation No", "Quotation Number", "Quotation #"],
    "email": ["Email", "Email Address", "E-mail"],
    "client": ["Client", "Client Name", "Company", "Company Name", "Customer", "Customer Name"],
}


def row_cells(row: dict[str, Any]) -> dict[str, Any]:
    return row.get("cells", row.get("values", {})) or {}


def value(cell: Any) -> Any:
    if isinstance(cell, dict):
        return cell.get("value")
    return cell


def canonical_key(header: str) -> str | None:
    h = header.strip().lower()
    for key, aliases in KEY_ALIASES.items():
        if h in {a.lower() for a in aliases}:
            return key
    return None


def extract_records(path: Path):
    doc = json.loads(path.read_text(encoding="utf-8"))
    for sheet in doc.get("sheets", []):
        for row in sheet.get("rows", []):
            cells = row_cells(row)
            indexed = defaultdict(list)
            for header, cell in cells.items():
                k = canonical_key(str(header))
                if k:
                    v = value(cell)
                    if v not in (None, ""):
                        indexed[k].append(str(v).strip())
            yield {
                "file": path.name,
                "dataset": DATASETS.get(path.name, "unknown"),
                "sheet": sheet.get("sheet_name"),
                "source_row_number": row.get("source_row_number"),
                "keys": {k: sorted(set(v)) for k, v in indexed.items()},
            }


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("source_dir", type=Path)
    p.add_argument("--output", type=Path, default=Path("reconciliation-report.json"))
    args = p.parse_args()

    records = []
    for path in sorted(args.source_dir.glob("*.json")):
        if path.name in {args.output.name, "source-manifest.json"}:
            continue
        try:
            records.extend(extract_records(path))
        except Exception as exc:
            records.append({"file": path.name, "error": str(exc)})

    groups: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for r in records:
        for key_name, values in r.get("keys", {}).items():
            for v in values:
                groups[(key_name, v)].append(r)

    matches = []
    for (key_name, key_value), rows in groups.items():
        datasets = sorted({r.get("dataset") for r in rows})
        if len(datasets) > 1:
            matches.append({
                "match_type": "cross_source_exact_key",
                "business_key": key_name,
                "business_key_value": key_value,
                "datasets": datasets,
                "records": rows,
                "resolution": "REVIEW_REQUIRED",
            })

    report = {
        "version": "1.0",
        "purpose": "Conservative cross-source reconciliation planning",
        "rules": {
            "source_mutation": False,
            "automatic_merge": False,
            "automatic_overwrite": False,
            "ambiguous_match_resolution": "data_conflict",
        },
        "record_count_scanned": len(records),
        "candidate_cross_source_matches": len(matches),
        "matches": matches,
    }
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {args.output}: {len(matches)} candidate cross-source matches")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
