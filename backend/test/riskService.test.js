const assert = require("assert").strict;

const { createRiskService } = require("../src/services/riskService");

const validSummary = {
  eventCount: 188,
  companyCount: 33,
  majorClassCount: 3,
  subcategoryCount: 11,
  numericGradeCount: 7,
  specialGradeEventCount: 26,
  gradeDistribution: [{ grade: "3", count: 9 }],
  classDistribution: [{ majorClass: "Corporate governance", count: 120 }],
};

describe("risk service", () => {
  it("returns validated risk analytics", async () => {
    const service = createRiskService({
      getSummary: async () => validSummary,
    });

    assert.deepEqual(await service.getRiskSummary(), validSummary);
  });

  it("rejects an invalid database summary", async () => {
    const service = createRiskService({
      getSummary: async () => ({ eventCount: "188" }),
    });

    await assert.rejects(service.getRiskSummary(), (error) => {
      assert.equal(error.statusCode, 500);
      assert.equal(error.code, "INVALID_RISK_DATA");
      return true;
    });
  });

  it("converts database failures into an operational error", async () => {
    const service = createRiskService({
      getSummary: async () => {
        throw new Error("connection refused");
      },
    });

    await assert.rejects(service.getRiskSummary(), (error) => {
      assert.equal(error.statusCode, 503);
      assert.equal(error.code, "RISK_DATA_UNAVAILABLE");
      return true;
    });
  });
});
