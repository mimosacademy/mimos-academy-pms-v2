#!/usr/bin/env python3
"""Validate Excel->JSON forensic extraction files without modifying them."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

REQUIRED_TOP = {"extraction_metadata", "workbook", "sheets", "integrity", "observations"}
REQUIRED_CELL = {"value", "formula", "data_type", "is_empty", "excel_error"}


def validate(path: Path) -> list[str]:
    errors: list[str] = []
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        return [f"invalid JSON: {exc}"]

    missing = REQUIRED_TOP - set(doc)
    if missing:
        errors.append(f"missing top-level keys: {sorted(missing)}")

    meta = doc.get("extraction_metadata", {})
    if meta.get("source_type") != "xlsx":
        errors.append("extraction_metadata.source_type must be xlsx")
    for flag in ("data_cleaned", "data_normalized", "data_deduplicated", "data_corrected"):
        if meta.get(flag) is not False:
            errors.append(f"{flag} must be false")

    workbook = doc.get("workbook", {})
    sheets = doc.get("sheets", [])
    if workbook.get("worksheet_count") != len(sheets):
        errors.append("worksheet_count does not match sheets length")

    total_rows = 0
    for si, sheet in enumerate(sheets, start=1):
        if sheet.get("sheet_index") != si:
            errors.append(f"sheet {si}: sheet_index mismatch")
        rows = sheet.get("rows", [])
        columns = sheet.get("columns", [])
        if sheet.get("row_count") != len(rows):
            errors.append(f"sheet {sheet.get('sheet_name')}: row_count mismatch")
        if sheet.get("column_count") != len(columns):
            errors.append(f"sheet {sheet.get('sheet_name')}: column_count mismatch")
        total_rows += len(rows)
        headers = [c.get("original_header") for c in columns]
        if len(headers) != len(set(headers)):
            errors.append(f"sheet {sheet.get('sheet_name')}: duplicate original headers")
        for row in rows:
            if not isinstance(row.get("source_row_number"), int):
                errors.append(f"sheet {sheet.get('sheet_name')}: invalid source_row_number")
            cells = row.get("cells", {})
            for header, cell in cells.items():
                if not REQUIRED_CELL.issubset(cell):
                    errors.append(f"sheet {sheet.get('sheet_name')} row {row.get('source_row_number')}: malformed cell {header!r}")
                if cell.get("is_empty") and cell.get("value") is not None:
                    errors.append(f"sheet {sheet.get('sheet_name')} row {row.get('source_row_number')}: empty cell has non-null value")
                if cell.get("excel_error") and cell.get("value") != cell.get("excel_error"):
                    errors.append(f"sheet {sheet.get('sheet_name')} row {row.get('source_row_number')}: excel_error/value mismatch")

    if workbook.get("total_rows") != total_rows:
        errors.append("workbook.total_rows does not match sheet totals")

    return errors


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("folder", type=Path)
    args = ap.parse_args()
    files = sorted(args.folder.glob("*.json"))
    if not files:
        print("No JSON files found")
        return 2
    failed = 0
    for path in files:
        errors = validate(path)
        if errors:
            failed += 1
            print(f"FAIL {path.name}")
            for error in errors:
                print(f"  - {error}")
        else:
            print(f"PASS {path.name}")
    print(f"Validated {len(files)} files; failures={failed}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
