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

function createRiskService(riskRepository) {
  if (!riskRepository || typeof riskRepository.getSummary !== "function") {
    throw new TypeError("A risk repository with a getSummary() method is required");
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
  };
}

module.exports = { createRiskService, isValidSummary };
