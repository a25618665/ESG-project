const assert = require("assert").strict;

const {
  CLASS_DISTRIBUTION_SQL,
  GRADE_DISTRIBUTION_SQL,
  RISK_TOTALS_SQL,
  createRiskRepository,
} = require("../src/repositories/riskRepository");

describe("risk repository", () => {
  it("combines totals and distributions from the database", async () => {
    const totals = {
      eventCount: 188,
      companyCount: 33,
      majorClassCount: 3,
      subcategoryCount: 11,
      numericGradeCount: 7,
      specialGradeEventCount: 26,
    };
    const gradeDistribution = [{ grade: "3", count: 9 }];
    const classDistribution = [
      { majorClass: "Corporate governance", count: 120 },
    ];
    const database = {
      async one(sql) {
        assert.equal(sql, RISK_TOTALS_SQL);
        return totals;
      },
      async any(sql) {
        if (sql === GRADE_DISTRIBUTION_SQL) return gradeDistribution;
        if (sql === CLASS_DISTRIBUTION_SQL) return classDistribution;
        throw new Error("Unexpected SQL query");
      },
    };

    const repository = createRiskRepository(database);

    assert.deepEqual(await repository.getSummary(), {
      ...totals,
      gradeDistribution,
      classDistribution,
    });
  });

  it("rejects an incompatible database client", () => {
    assert.throws(
      () => createRiskRepository({ one() {} }),
      /database client with one\(\) and any\(\) methods is required/
    );
  });
});
