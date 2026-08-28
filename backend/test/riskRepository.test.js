const assert = require("assert").strict;

const {
  CLASS_DISTRIBUTION_SQL,
  GRADE_DISTRIBUTION_SQL,
  RISK_EVENT_COUNT_SQL,
  RISK_EVENT_LIST_SQL,
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

  it("uses parameterized filters and pagination for risk events", async () => {
    const calls = [];
    const database = {
      async one(sql, values) {
        calls.push({ sql, values });
        return { total: 1 };
      },
      async any(sql, values) {
        calls.push({ sql, values });
        return [{ id: 9, companyCode: "002628" }];
      },
    };
    const repository = createRiskRepository(database);
    const filters = {
      grade: "9",
      majorClass: "營運風險上升",
      companyCode: "002628",
      limit: 10,
      offset: 20,
    };

    assert.deepEqual(await repository.listEvents(filters), {
      events: [{ id: 9, companyCode: "002628" }],
      total: 1,
    });
    assert.deepEqual(calls, [
      {
        sql: RISK_EVENT_COUNT_SQL,
        values: ["9", "營運風險上升", "002628"],
      },
      {
        sql: RISK_EVENT_LIST_SQL,
        values: ["9", "營運風險上升", "002628", 10, 20],
      },
    ]);
  });
});
