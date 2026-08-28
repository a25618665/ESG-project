#!/usr/bin/env python3
"""Generate the normalized CCRI PostgreSQL seed from the tracked workbook."""

from __future__ import annotations

import argparse
import re
import sys
from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

import xlrd


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_WORKBOOK = REPOSITORY_ROOT / "data" / "CCRI風險趨勢與組成&重大訊息_tw.xls"
DEFAULT_OUTPUT = REPOSITORY_ROOT / "database" / "init" / "004_risk_data.sql"
SOURCE_SHEET_NAME = "重大訊息(全體中國上市公司)"
EXPECTED_HEADERS = (
    "公司碼",
    "日期",
    "序號",
    "CCRI-數量模型(資料年月)",
    "新聞內容",
    "事件大分類",
    "事件小分類名",
)
EXPECTED_COUNTS = {
    "events": 188,
    "companies": 33,
    "major_classes": 3,
    "subcategories": 11,
    "numeric_grades": 7,
    "special_grade_events": 26,
}
EXPECTED_GRADE_DISTRIBUTION = {
    "3": 9,
    "4": 2,
    "5": 50,
    "6": 47,
    "7": 19,
    "8": 11,
    "9": 24,
    "D": 26,
}
COMPANY_PATTERN = re.compile(r"^(?P<code>\d{6})\s+(?P<name>.+)$")
EVENT_CODE_PATTERN = re.compile(r"^[A-Z]\d{7}$")
GRADE_PERIOD_PATTERN = re.compile(
    r"^(?P<grade>[3-9D])\((?P<period>\d{4}/(?:0[1-9]|1[0-2]))\)$"
)


@dataclass(frozen=True)
class RiskEvent:
    source_row: int
    company_code: str
    company_name: str
    event_date: date
    event_code: str
    ccri_grade: str
    data_period: str
    major_class: str
    subcategory: str


class SourceValidationError(ValueError):
    """Raised when the workbook does not match the expected source contract."""


def parse_company(value: object, source_row: int) -> tuple[str, str]:
    text = str(value).strip()
    match = COMPANY_PATTERN.fullmatch(text)
    if not match:
        raise SourceValidationError(
            f"Row {source_row}: expected '<six-digit code> <company name>', got {text!r}"
        )
    return match.group("code"), match.group("name").strip()


def parse_grade_period(value: object, source_row: int) -> tuple[str, str]:
    text = str(value).strip()
    match = GRADE_PERIOD_PATTERN.fullmatch(text)
    if not match:
        raise SourceValidationError(
            f"Row {source_row}: expected '<grade>(YYYY/MM)', got {text!r}"
        )
    return match.group("grade"), match.group("period")


def parse_event_date(value: object, datemode: int, source_row: int) -> date:
    try:
        if isinstance(value, (int, float)):
            return xlrd.xldate_as_datetime(value, datemode).date()
        return datetime.strptime(str(value).strip(), "%Y-%m-%d").date()
    except (TypeError, ValueError, xlrd.XLDateError) as error:
        raise SourceValidationError(
            f"Row {source_row}: invalid event date {value!r}"
        ) from error


def required_text(value: object, field: str, source_row: int) -> str:
    text = str(value).strip()
    if not text:
        raise SourceValidationError(f"Row {source_row}: {field} is empty")
    return text


def load_events(workbook_path: Path) -> list[RiskEvent]:
    if not workbook_path.is_file():
        raise SourceValidationError(f"Workbook not found: {workbook_path}")

    workbook = xlrd.open_workbook(workbook_path)
    try:
        sheet = workbook.sheet_by_name(SOURCE_SHEET_NAME)
    except xlrd.XLRDError as error:
        raise SourceValidationError(
            f"Source sheet {SOURCE_SHEET_NAME!r} was not found"
        ) from error
    headers = tuple(str(sheet.cell_value(0, column)).strip() for column in range(7))
    if headers != EXPECTED_HEADERS:
        raise SourceValidationError(
            f"Unexpected source headers: {headers!r}; expected {EXPECTED_HEADERS!r}"
        )

    events: list[RiskEvent] = []
    for row_index in range(1, sheet.nrows):
        source_row = row_index + 1
        company_code, company_name = parse_company(
            sheet.cell_value(row_index, 0), source_row
        )
        event_date = parse_event_date(
            sheet.cell_value(row_index, 1), workbook.datemode, source_row
        )
        event_code = required_text(
            sheet.cell_value(row_index, 2), "event code", source_row
        )
        if not EVENT_CODE_PATTERN.fullmatch(event_code):
            raise SourceValidationError(
                f"Row {source_row}: invalid event code {event_code!r}"
            )

        ccri_grade, data_period = parse_grade_period(
            sheet.cell_value(row_index, 3), source_row
        )
        major_class = required_text(
            sheet.cell_value(row_index, 5), "major class", source_row
        )
        subcategory = required_text(
            sheet.cell_value(row_index, 6), "subcategory", source_row
        )
        events.append(
            RiskEvent(
                source_row=source_row,
                company_code=company_code,
                company_name=company_name,
                event_date=event_date,
                event_code=event_code,
                ccri_grade=ccri_grade,
                data_period=data_period,
                major_class=major_class,
                subcategory=subcategory,
            )
        )

    validate_events(events)
    return events


def validate_events(events: list[RiskEvent]) -> None:
    companies: dict[str, str] = {}
    business_keys: set[tuple[str, str, str]] = set()

    for event in events:
        known_name = companies.setdefault(event.company_code, event.company_name)
        if known_name != event.company_name:
            raise SourceValidationError(
                f"Company {event.company_code} has conflicting names: "
                f"{known_name!r} and {event.company_name!r}"
            )

        key = (event.company_code, event.event_code, event.data_period)
        if key in business_keys:
            raise SourceValidationError(f"Duplicate event key at row {event.source_row}: {key}")
        business_keys.add(key)

    grades = Counter(event.ccri_grade for event in events)
    actual_counts = {
        "events": len(events),
        "companies": len(companies),
        "major_classes": len({event.major_class for event in events}),
        "subcategories": len(
            {(event.major_class, event.subcategory) for event in events}
        ),
        "numeric_grades": len({grade for grade in grades if grade.isdigit()}),
        "special_grade_events": grades["D"],
    }
    if actual_counts != EXPECTED_COUNTS:
        raise SourceValidationError(
            f"Source dimensions changed: {actual_counts!r}; expected {EXPECTED_COUNTS!r}"
        )
    if dict(sorted(grades.items())) != EXPECTED_GRADE_DISTRIBUTION:
        raise SourceValidationError(
            f"Grade distribution changed: {dict(sorted(grades.items()))!r}; "
            f"expected {EXPECTED_GRADE_DISTRIBUTION!r}"
        )


def sql_literal(value: object) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def render_seed(events: list[RiskEvent]) -> str:
    companies = sorted(
        {(event.company_code, event.company_name) for event in events}
    )
    categories = sorted(
        {(event.major_class, event.subcategory) for event in events}
    )

    lines = [
        "-- Generated by tools/generate_risk_seed.py from",
        "-- data/CCRI風險趨勢與組成&重大訊息_tw.xls.",
        "-- Full news text is intentionally excluded; source_row preserves workbook provenance.",
        "-- Verified dimensions: 188 events, 33 companies, 3 major classes, 11 subcategories.",
        "",
        "INSERT INTO research_company (source_code, name)",
        "VALUES",
    ]
    for index, (code, name) in enumerate(companies):
        suffix = "," if index < len(companies) - 1 else ""
        lines.append(f"  ({sql_literal(code)}, {sql_literal(name)}){suffix}")
    lines.extend(
        [
            "ON CONFLICT (source_code) DO UPDATE",
            "SET name = EXCLUDED.name;",
            "",
            "INSERT INTO risk_category (major_class, subcategory)",
            "VALUES",
        ]
    )
    for index, (major_class, subcategory) in enumerate(categories):
        suffix = "," if index < len(categories) - 1 else ""
        lines.append(
            f"  ({sql_literal(major_class)}, {sql_literal(subcategory)}){suffix}"
        )
    lines.extend(
        [
            "ON CONFLICT (major_class, subcategory) DO NOTHING;",
            "",
            "WITH source_data (",
            "  source_row, company_code, event_date, event_code, ccri_grade,",
            "  data_period, major_class, subcategory",
            ") AS (",
            "  VALUES",
        ]
    )
    for index, event in enumerate(events):
        suffix = "," if index < len(events) - 1 else ""
        lines.append(
            "    ("
            f"{event.source_row}, {sql_literal(event.company_code)}, "
            f"{sql_literal(event.event_date.isoformat())}, "
            f"{sql_literal(event.event_code)}, {sql_literal(event.ccri_grade)}, "
            f"{sql_literal(event.data_period)}, {sql_literal(event.major_class)}, "
            f"{sql_literal(event.subcategory)}){suffix}"
        )
    lines.extend(
        [
            ")",
            "INSERT INTO risk_event (",
            "  source_row, company_id, event_date, event_code, ccri_grade,",
            "  data_period, category_id",
            ")",
            "SELECT",
            "  source_data.source_row,",
            "  research_company.id,",
            "  source_data.event_date::date,",
            "  source_data.event_code,",
            "  source_data.ccri_grade,",
            "  source_data.data_period,",
            "  risk_category.id",
            "FROM source_data",
            "JOIN research_company",
            "  ON research_company.source_code = source_data.company_code",
            "JOIN risk_category",
            "  ON risk_category.major_class = source_data.major_class",
            " AND risk_category.subcategory = source_data.subcategory",
            "ON CONFLICT (source_row) DO UPDATE",
            "SET company_id = EXCLUDED.company_id,",
            "    event_date = EXCLUDED.event_date,",
            "    event_code = EXCLUDED.event_code,",
            "    ccri_grade = EXCLUDED.ccri_grade,",
            "    data_period = EXCLUDED.data_period,",
            "    category_id = EXCLUDED.category_id;",
            "",
        ]
    )
    return "\n".join(lines)


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workbook", type=Path, default=DEFAULT_WORKBOOK)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Fail if the committed SQL differs from freshly generated output.",
    )
    return parser.parse_args()


def main() -> int:
    arguments = parse_arguments()
    try:
        generated = render_seed(load_events(arguments.workbook))
    except (OSError, SourceValidationError, xlrd.XLRDError) as error:
        print(f"Risk seed generation failed: {error}", file=sys.stderr)
        return 1

    if arguments.check:
        try:
            committed = arguments.output.read_text(encoding="utf-8")
        except OSError as error:
            print(f"Cannot read generated seed {arguments.output}: {error}", file=sys.stderr)
            return 1
        if committed != generated:
            print(
                "Generated risk seed is out of date. Run "
                "'python tools/generate_risk_seed.py' and commit the result.",
                file=sys.stderr,
            )
            return 1
        print(f"Verified {arguments.output} against {arguments.workbook}.")
        return 0

    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    arguments.output.write_text(generated, encoding="utf-8", newline="\n")
    print(f"Generated {arguments.output} from {arguments.workbook}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
