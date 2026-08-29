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

const validEvent = {
  id: 1,
  sourceRow: 2,
  companyCode: "000063",
  companyName: "中興通訊",
  eventDate: "2017-02-22",
  eventCode: "T0100001",
  ccriGrade: "7",
  dataPeriod: "2016/06",
  majorClass: "公司治理問題",
  subcategory: "董監高管異動(非董監改選)",
};

function buildRepository(overrides = {}) {
  return {
    getSummary: async () => validSummary,
    listEvents: async () => ({ events: [validEvent], total: 1 }),
    ...overrides,
  };
}

describe("risk service", () => {
  it("returns validated risk analytics", async () => {
    const service = createRiskService(buildRepository());

    assert.deepEqual(await service.getRiskSummary(), validSummary);
  });

  it("reuses validated risk analytics within the cache TTL", async () => {
    let repositoryCalls = 0;
    const service = createRiskService(
      buildRepository({
        getSummary: async () => {
          repositoryCalls += 1;
          return validSummary;
        },
      })
    );

    await service.getRiskSummary();
    await service.getRiskSummary();

    assert.equal(repositoryCalls, 1);
  });

  it("rejects an invalid database summary", async () => {
    const service = createRiskService(buildRepository({
      getSummary: async () => ({ eventCount: "188" }),
    }));

    await assert.rejects(service.getRiskSummary(), (error) => {
      assert.equal(error.statusCode, 500);
      assert.equal(error.code, "INVALID_RISK_DATA");
      return true;
    });
  });

  it("converts database failures into an operational error", async () => {
    const service = createRiskService(buildRepository({
      getSummary: async () => {
        throw new Error("connection refused");
      },
    }));

    await assert.rejects(service.getRiskSummary(), (error) => {
      assert.equal(error.statusCode, 503);
      assert.equal(error.code, "RISK_DATA_UNAVAILABLE");
      return true;
    });
  });

  it("normalizes filters and returns pagination metadata", async () => {
    let receivedFilters;
    const service = createRiskService(
      buildRepository({
        listEvents: async (filters) => {
          receivedFilters = filters;
          return { events: [validEvent], total: 17 };
        },
      })
    );

    assert.deepEqual(
      await service.getRiskEvents({
        grade: "d",
        companyCode: "000063",
        limit: "10",
        offset: "10",
      }),
      {
        data: [validEvent],
        meta: { total: 17, count: 1, limit: 10, offset: 10 },
      }
    );
    assert.deepEqual(receivedFilters, {
      grade: "D",
      majorClass: null,
      companyCode: "000063",
      limit: 10,
      offset: 10,
    });
  });

  it("rejects unsupported and malformed filters", async () => {
    const service = createRiskService(buildRepository());

    for (const query of [
      { sort: "company" },
      { grade: "10" },
      { grade: ["7", "8"] },
      { companyCode: "123" },
      { limit: "0" },
      { offset: "-1" },
    ]) {
      await assert.rejects(service.getRiskEvents(query), (error) => {
        assert.equal(error.statusCode, 400);
        assert.equal(error.code, "INVALID_QUERY_PARAMETER");
        return true;
      });
    }
  });

  it("rejects invalid event records returned by the database", async () => {
    const service = createRiskService(
      buildRepository({
        listEvents: async () => ({ events: [{ id: "1" }], total: 1 }),
      })
    );

    await assert.rejects(service.getRiskEvents({}), (error) => {
      assert.equal(error.statusCode, 500);
      assert.equal(error.code, "INVALID_RISK_DATA");
      return true;
    });
  });
});
