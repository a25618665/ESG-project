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

const RISK_EVENT_FILTERS_SQL = `
  WHERE ($1::text IS NULL OR risk_event.ccri_grade = $1)
    AND ($2::text IS NULL OR risk_category.major_class = $2)
    AND ($3::text IS NULL OR research_company.source_code = $3)
`;

const RISK_EVENT_COUNT_SQL = `
  SELECT COUNT(*)::integer AS total
  FROM risk_event
  JOIN research_company ON research_company.id = risk_event.company_id
  JOIN risk_category ON risk_category.id = risk_event.category_id
  ${RISK_EVENT_FILTERS_SQL}
`;

const RISK_EVENT_LIST_SQL = `
  SELECT
    risk_event.id::integer AS id,
    risk_event.source_row AS "sourceRow",
    research_company.source_code AS "companyCode",
    research_company.name AS "companyName",
    TO_CHAR(risk_event.event_date, 'YYYY-MM-DD') AS "eventDate",
    risk_event.event_code AS "eventCode",
    risk_event.ccri_grade AS "ccriGrade",
    risk_event.data_period AS "dataPeriod",
    risk_category.major_class AS "majorClass",
    risk_category.subcategory
  FROM risk_event
  JOIN research_company ON research_company.id = risk_event.company_id
  JOIN risk_category ON risk_category.id = risk_event.category_id
  ${RISK_EVENT_FILTERS_SQL}
  ORDER BY risk_event.event_date DESC, risk_event.source_row ASC
  LIMIT $4 OFFSET $5
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

    async listEvents({ grade, majorClass, companyCode, limit, offset }) {
      const filters = [grade, majorClass, companyCode];
      const [countResult, events] = await Promise.all([
        database.one(RISK_EVENT_COUNT_SQL, filters),
        database.any(RISK_EVENT_LIST_SQL, [...filters, limit, offset]),
      ]);

      return { events, total: countResult.total };
    },
  };
}

module.exports = {
  CLASS_DISTRIBUTION_SQL,
  GRADE_DISTRIBUTION_SQL,
  RISK_EVENT_COUNT_SQL,
  RISK_EVENT_LIST_SQL,
  RISK_TOTALS_SQL,
  createRiskRepository,
};
