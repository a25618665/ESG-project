const AppError = require("../errors/AppError");

const SUMMARY_METRICS = [
  "eventCount",
  "companyCount",
  "majorClassCount",
  "subcategoryCount",
  "numericGradeCount",
  "specialGradeEventCount",
];

function isDistribution(distribution, labelKey) {
  return (
    Array.isArray(distribution) &&
    distribution.every(
      (entry) =>
        entry &&
        typeof entry[labelKey] === "string" &&
        Number.isInteger(entry.count) &&
        entry.count >= 0
    )
  );
}

function isValidSummary(summary) {
  return (
    summary &&
    typeof summary === "object" &&
    SUMMARY_METRICS.every(
      (metric) => Number.isInteger(summary[metric]) && summary[metric] >= 0
    ) &&
    isDistribution(summary.gradeDistribution, "grade") &&
    isDistribution(summary.classDistribution, "majorClass")
  );
}

const ALLOWED_FILTERS = new Set([
  "grade",
  "majorClass",
  "companyCode",
  "limit",
  "offset",
]);

function invalidQuery(message) {
  return new AppError(message, 400, "INVALID_QUERY_PARAMETER");
}

function parseInteger(value, name, defaultValue, minimum, maximum) {
  if (value === undefined || value === "") return defaultValue;
  if (!/^\d+$/.test(String(value))) {
    throw invalidQuery(`${name} must be an integer`);
  }

  const parsed = Number(value);
  if (parsed < minimum || parsed > maximum) {
    throw invalidQuery(`${name} must be between ${minimum} and ${maximum}`);
  }
  return parsed;
}

function normalizeRiskEventQuery(query = {}) {
  const unknown = Object.keys(query).find((key) => !ALLOWED_FILTERS.has(key));
  if (unknown) throw invalidQuery(`Unsupported query parameter: ${unknown}`);

  const repeated = Object.keys(query).find((key) => Array.isArray(query[key]));
  if (repeated) throw invalidQuery(`${repeated} must be provided only once`);

  const grade = query.grade ? String(query.grade).trim().toUpperCase() : null;
  if (grade && !/^(?:[3-9]|D)$/.test(grade)) {
    throw invalidQuery("grade must be 3-9 or D");
  }

  const companyCode = query.companyCode
    ? String(query.companyCode).trim()
    : null;
  if (companyCode && !/^\d{6}$/.test(companyCode)) {
    throw invalidQuery("companyCode must contain exactly 6 digits");
  }

  const normalizedMajorClass = query.majorClass
    ? String(query.majorClass).trim()
    : "";
  const majorClass = normalizedMajorClass || null;
  if (majorClass && majorClass.length > 100) {
    throw invalidQuery("majorClass must not exceed 100 characters");
  }

  return {
    grade,
    majorClass,
    companyCode,
    limit: parseInteger(query.limit, "limit", 20, 1, 100),
    offset: parseInteger(query.offset, "offset", 0, 0, 10000),
  };
}

function isValidRiskEvent(event) {
  return (
    event &&
    Number.isInteger(event.id) &&
    Number.isInteger(event.sourceRow) &&
    [
      "companyCode",
      "companyName",
      "eventDate",
      "eventCode",
      "ccriGrade",
      "dataPeriod",
      "majorClass",
      "subcategory",
    ].every((field) => typeof event[field] === "string")
  );
}

function createRiskService(riskRepository) {
  if (
    !riskRepository ||
    typeof riskRepository.getSummary !== "function" ||
    typeof riskRepository.listEvents !== "function"
  ) {
    throw new TypeError(
      "A risk repository with getSummary() and listEvents() methods is required"
    );
  }

  return {
    async getRiskSummary() {
      try {
        const summary = await riskRepository.getSummary();

        if (!isValidSummary(summary)) {
          throw new AppError(
            "The database returned invalid risk analytics",
            500,
            "INVALID_RISK_DATA"
          );
        }

        return summary;
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }

        throw new AppError(
          "Risk analytics are temporarily unavailable",
          503,
          "RISK_DATA_UNAVAILABLE"
        );
      }
    },

    async getRiskEvents(query) {
      const filters = normalizeRiskEventQuery(query);

      try {
        const result = await riskRepository.listEvents(filters);
        if (
          !result ||
          !Array.isArray(result.events) ||
          !result.events.every(isValidRiskEvent) ||
          !Number.isInteger(result.total) ||
          result.total < 0
        ) {
          throw new AppError(
            "The database returned invalid risk events",
            500,
            "INVALID_RISK_DATA"
          );
        }

        return {
          data: result.events,
          meta: {
            total: result.total,
            count: result.events.length,
            limit: filters.limit,
            offset: filters.offset,
          },
        };
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(
          "Risk events are temporarily unavailable",
          503,
          "RISK_DATA_UNAVAILABLE"
        );
      }
    },
  };
}

module.exports = {
  createRiskService,
  isValidSummary,
  normalizeRiskEventQuery,
};
