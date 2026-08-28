from __future__ import annotations

import unittest
from datetime import date

from tools.generate_risk_seed import (
    EXPECTED_COUNTS,
    RiskEvent,
    SourceValidationError,
    parse_company,
    parse_grade_period,
    render_seed,
    sql_literal,
    validate_events,
)


class RiskSeedGeneratorTest(unittest.TestCase):
    def test_parses_company_identifier_and_name(self) -> None:
        self.assertEqual(parse_company("000063 中興通訊", 2), ("000063", "中興通訊"))

    def test_rejects_invalid_company_identifier(self) -> None:
        with self.assertRaisesRegex(SourceValidationError, "six-digit code"):
            parse_company("63 中興通訊", 2)

    def test_parses_numeric_and_special_grades(self) -> None:
        self.assertEqual(parse_grade_period("7(2016/06)", 2), ("7", "2016/06"))
        self.assertEqual(parse_grade_period("D(2016/06)", 2), ("D", "2016/06"))

    def test_rejects_invalid_grade_period(self) -> None:
        with self.assertRaisesRegex(SourceValidationError, "YYYY/MM"):
            parse_grade_period("10(2016/13)", 2)

    def test_escapes_sql_literals(self) -> None:
        self.assertEqual(sql_literal("O'Reilly"), "'O''Reilly'")

    def test_rejects_unexpected_source_dimensions(self) -> None:
        with self.assertRaisesRegex(SourceValidationError, "Source dimensions changed"):
            validate_events([])

    def test_renders_parameter_data_without_news_text(self) -> None:
        event = RiskEvent(
            source_row=2,
            company_code="000063",
            company_name="中興通訊",
            event_date=date(2017, 2, 22),
            event_code="T0100001",
            ccri_grade="7",
            data_period="2016/06",
            major_class="公司治理問題",
            subcategory="董監高管異動(非董監改選)",
        )
        sql = render_seed([event])
        self.assertIn("'000063'", sql)
        self.assertIn("'2017-02-22'", sql)
        self.assertNotIn("新聞內容", sql)

    def test_documents_the_expected_event_count(self) -> None:
        self.assertEqual(EXPECTED_COUNTS["events"], 188)


if __name__ == "__main__":
    unittest.main()
