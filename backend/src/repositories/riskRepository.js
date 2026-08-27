const RISK_TOTALS_SQL = `
  SELECT
    COUNT(*)::integer AS "eventCount",
    COUNT(DISTINCT risk_event.company_id)::integer AS "companyCount",
    COUNT(DISTINCT risk_category.major_class)::integer AS "majorClassCount",
    COUNT(DISTINCT risk_event.category_id)::integer AS "subcategoryCount",
    COUNT(DISTINCT CASE
      WHEN risk_event.ccri_grade ~ '^[3-9]$' THEN risk_event.ccri_grade
    END)::integer AS "numericGradeCount",
    COUNT(CASE
      WHEN risk_event.ccri_grade = 'D' THEN 1
    END)::integer AS "specialGradeEventCount"
  FROM risk_event
  JOIN risk_category ON risk_category.id = risk_event.category_id
`;

const GRADE_DISTRIBUTION_SQL = `
  SELECT
    ccri_grade AS grade,
    COUNT(*)::integer AS count
  FROM risk_event
  GROUP BY ccri_grade
  ORDER BY
    CASE WHEN ccri_grade = 'D' THEN 99 ELSE ccri_grade::integer END
`;

const CLASS_DISTRIBUTION_SQL = `
  SELECT
    risk_category.major_class AS "majorClass",
    COUNT(*)::integer AS count
  FROM risk_event
  JOIN risk_category ON risk_category.id = risk_event.category_id
  GROUP BY risk_category.major_class
  ORDER BY count DESC, risk_category.major_class
`;

function createRiskRepository(database) {
  if (
    !database ||
    typeof database.one !== "function" ||
    typeof database.any !== "function"
  ) {
    throw new TypeError(
      "A database client with one() and any() methods is required"
    );
  }

  return {
    async getSummary() {
      const [totals, gradeDistribution, classDistribution] =
        await Promise.all([
          database.one(RISK_TOTALS_SQL),
          database.any(GRADE_DISTRIBUTION_SQL),
          database.any(CLASS_DISTRIBUTION_SQL),
        ]);

      return {
        ...totals,
        gradeDistribution,
        classDistribution,
      };
    },
  };
}

module.exports = {
  CLASS_DISTRIBUTION_SQL,
  GRADE_DISTRIBUTION_SQL,
  RISK_TOTALS_SQL,
  createRiskRepository,
};
