const assert = require("assert").strict;
const request = require("supertest");

const { createApp } = require("../app");
const AppError = require("../src/errors/AppError");

describe("ESG API", () => {
  const companies = [
    { id: 1, name: "Alpha" },
    { id: 2, name: "Beta" },
  ];
  const riskSummary = {
    eventCount: 188,
    companyCount: 33,
    majorClassCount: 3,
    subcategoryCount: 11,
    numericGradeCount: 7,
    specialGradeEventCount: 26,
    gradeDistribution: [{ grade: "3", count: 9 }],
    classDistribution: [
      { majorClass: "Corporate governance", count: 120 },
    ],
  };
  const riskEvents = {
    data: [
      {
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
      },
    ],
    meta: { total: 1, count: 1, limit: 20, offset: 0 },
  };

  function buildApp(
    listCompanies = async () => companies,
    getRiskSummary = async () => riskSummary,
    getRiskEvents = async () => riskEvents
  ) {
    return createApp({
      companyService: { listCompanies },
      riskService: { getRiskSummary, getRiskEvents },
      corsOrigin: "http://localhost:8080",
      environment: "test",
    });
  }

  it("reports service health", async () => {
    const response = await request(buildApp()).get("/health").expect(200);

    assert.deepEqual(response.body, { status: "ok", service: "esg-api" });
  });

  it("documents its public endpoints", async () => {
    const response = await request(buildApp()).get("/").expect(200);

    assert.equal(response.body.name, "ESG Analytics API");
    assert.equal(response.body.endpoints.companies, "/api/companies");
    assert.equal(response.body.endpoints.riskSummary, "/api/risk-summary");
    assert.equal(response.body.endpoints.riskEvents, "/api/risk-events");
  });

  it("returns structured risk analytics", async () => {
    const response = await request(buildApp())
      .get("/api/risk-summary")
      .expect(200);

    assert.deepEqual(response.body, { data: riskSummary });
  });

  it("preserves operational risk-service errors", async () => {
    const getRiskSummary = async () => {
      throw new AppError(
        "Risk analytics are temporarily unavailable",
        503,
        "RISK_DATA_UNAVAILABLE"
      );
    };
    const response = await request(buildApp(undefined, getRiskSummary))
      .get("/api/risk-summary")
      .expect(503);

    assert.equal(response.body.error.code, "RISK_DATA_UNAVAILABLE");
  });

  it("returns filtered risk events with pagination metadata", async () => {
    let receivedQuery;
    const getRiskEvents = async (query) => {
      receivedQuery = query;
      return riskEvents;
    };
    const response = await request(
      buildApp(undefined, undefined, getRiskEvents)
    )
      .get("/api/risk-events?grade=7&limit=10&offset=0")
      .expect(200);

    assert.deepEqual(response.body, riskEvents);
    assert.deepEqual({ ...receivedQuery }, {
      grade: "7",
      limit: "10",
      offset: "0",
    });
  });

  it("returns structured validation errors for invalid filters", async () => {
    const getRiskEvents = async () => {
      throw new AppError(
        "grade must be 3-9 or D",
        400,
        "INVALID_QUERY_PARAMETER"
      );
    };
    const response = await request(
      buildApp(undefined, undefined, getRiskEvents)
    )
      .get("/api/risk-events?grade=10")
      .expect(400);

    assert.equal(response.body.error.code, "INVALID_QUERY_PARAMETER");
  });

  it("returns a structured company collection", async () => {
    const response = await request(buildApp())
      .get("/api/companies")
      .expect(200);

    assert.deepEqual(response.body.data, companies);
    assert.equal(response.body.meta.count, 2);
  });

  it("preserves the legacy company response", async () => {
    const response = await request(buildApp()).get("/company").expect(200);

    assert.deepEqual(response.body, companies);
  });

  it("allows the configured browser origin", async () => {
    const response = await request(buildApp())
      .get("/health")
      .set("Origin", "http://localhost:8080")
      .expect(200);

    assert.equal(
      response.headers["access-control-allow-origin"],
      "http://localhost:8080"
    );
  });

  it("handles CORS preflight requests", async () => {
    await request(buildApp())
      .options("/api/companies")
      .set("Origin", "http://localhost:8080")
      .expect(204);
  });

  it("returns a consistent response for unknown routes", async () => {
    const response = await request(buildApp()).get("/missing").expect(404);

    assert.deepEqual(response.body, {
      error: {
        code: "ROUTE_NOT_FOUND",
        message: "Route not found: GET /missing",
      },
    });
  });

  it("preserves operational errors from the service layer", async () => {
    const listCompanies = async () => {
      throw new AppError(
        "Company data is temporarily unavailable",
        503,
        "COMPANY_DATA_UNAVAILABLE"
      );
    };
    const response = await request(buildApp(listCompanies))
      .get("/api/companies")
      .expect(503);

    assert.equal(response.body.error.code, "COMPANY_DATA_UNAVAILABLE");
  });

  it("does not expose unexpected internal errors", async () => {
    const listCompanies = async () => {
      throw new Error("database hostname and password details");
    };
    const response = await request(buildApp(listCompanies))
      .get("/api/companies")
      .expect(500);

    assert.deepEqual(response.body, {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected server error occurred",
      },
    });
  });
});
