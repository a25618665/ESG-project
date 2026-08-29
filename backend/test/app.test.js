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
  const readiness = {
    status: "ready",
    service: "esg-api",
    dependencies: { database: "up" },
  };

  function buildApp(
    listCompanies = async () => companies,
    getRiskSummary = async () => riskSummary,
    getRiskEvents = async () => riskEvents,
    checkReadiness = async () => readiness,
    appOptions = {}
  ) {
    return createApp({
      companyService: { listCompanies },
      riskService: { getRiskSummary, getRiskEvents },
      readinessService: { checkReadiness },
      corsOrigin: "http://localhost:8080",
      environment: "test",
      requestIdFactory: () => "test-request-id",
      ...appOptions,
    });
  }

  it("reports service health", async () => {
    const response = await request(buildApp()).get("/health").expect(200);

    assert.deepEqual(response.body, { status: "ok", service: "esg-api" });
    assert.equal(response.headers["x-request-id"], "test-request-id");
    assert.equal(response.headers["cache-control"], "no-store");
  });

  it("applies explicit API security headers without framework fingerprinting", async () => {
    const response = await request(buildApp()).get("/health").expect(200);

    assert.equal(
      response.headers["content-security-policy"],
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    );
    assert.equal(
      response.headers["permissions-policy"],
      "camera=(), geolocation=(), microphone=()"
    );
    assert.equal(response.headers["referrer-policy"], "no-referrer");
    assert.equal(response.headers["x-content-type-options"], "nosniff");
    assert.equal(response.headers["x-frame-options"], "DENY");
    assert.equal(response.headers["x-powered-by"], undefined);
  });

  it("preserves a valid caller-provided request ID", async () => {
    const response = await request(buildApp())
      .get("/health")
      .set("X-Request-Id", "client.trace-123")
      .expect(200);

    assert.equal(response.headers["x-request-id"], "client.trace-123");
  });

  it("replaces an invalid caller-provided request ID", async () => {
    const response = await request(buildApp())
      .get("/health")
      .set("X-Request-Id", "request id with spaces")
      .expect(200);

    assert.equal(response.headers["x-request-id"], "test-request-id");
  });

  it("reports service readiness when PostgreSQL responds", async () => {
    const response = await request(buildApp()).get("/ready").expect(200);

    assert.deepEqual(response.body, readiness);
  });

  it("reports unavailable dependencies without exposing internals", async () => {
    const checkReadiness = async () => {
      throw new AppError(
        "Service dependencies are unavailable",
        503,
        "SERVICE_NOT_READY"
      );
    };
    const response = await request(
      buildApp(undefined, undefined, undefined, checkReadiness)
    )
      .get("/ready")
      .expect(503);

    assert.deepEqual(response.body, {
      error: {
        code: "SERVICE_NOT_READY",
        message: "Service dependencies are unavailable",
        requestId: "test-request-id",
      },
    });
  });

  it("documents its public endpoints", async () => {
    const response = await request(buildApp()).get("/").expect(200);

    assert.equal(response.body.name, "ESG Analytics API");
    assert.equal(response.body.endpoints.readiness, "/ready");
    assert.equal(response.body.endpoints.apiContract, "/openapi.json");
    assert.equal(response.body.endpoints.companies, "/api/companies");
    assert.equal(response.body.endpoints.riskSummary, "/api/risk-summary");
    assert.equal(response.body.endpoints.riskEvents, "/api/risk-events");
  });

  it("serves the machine-readable API contract", async () => {
    const response = await request(buildApp())
      .get("/openapi.json")
      .expect("Content-Type", /json/)
      .expect(200);

    assert.equal(response.body.openapi, "3.1.0");
    assert.equal(response.body.info.title, "ESG Analytics API");
    assert.ok(response.body.paths["/api/risk-events"]);
  });

  it("returns structured risk analytics", async () => {
    const response = await request(buildApp())
      .get("/api/risk-summary")
      .expect(200);

    assert.deepEqual(response.body, { data: riskSummary });
    assert.equal(
      response.headers["cache-control"],
      "public, max-age=30, stale-while-revalidate=60"
    );
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
    assert.equal(response.headers["cache-control"], "no-store");
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
    const response = await request(buildApp())
      .options("/api/companies")
      .set("Origin", "http://localhost:8080")
      .expect(204);

    assert.match(
      response.headers["access-control-allow-headers"],
      /X-Request-Id/
    );
    assert.equal(
      response.headers["access-control-expose-headers"],
      "X-Request-Id"
    );
  });

  it("correlates structured request logs with error responses", async () => {
    const entries = [];
    const app = buildApp(undefined, undefined, undefined, undefined, {
      requestLogger: (entry) => entries.push(entry),
    });
    const response = await request(app)
      .get("/missing?privateFilter=omitted-from-log")
      .set("X-Request-Id", "trace-404")
      .expect(404);

    assert.deepEqual(response.body, {
      error: {
        code: "ROUTE_NOT_FOUND",
        message: "Route not found: GET /missing",
        requestId: "trace-404",
      },
    });
    assert.doesNotMatch(JSON.stringify(response.body), /privateFilter/);
    assert.equal(response.headers["x-request-id"], "trace-404");
    assert.equal(entries.length, 1);
    assert.deepEqual(
      {
        level: entries[0].level,
        event: entries[0].event,
        requestId: entries[0].requestId,
        method: entries[0].method,
        path: entries[0].path,
        statusCode: entries[0].statusCode,
        errorCode: entries[0].errorCode,
      },
      {
        level: "warn",
        event: "http_request",
        requestId: "trace-404",
        method: "GET",
        path: "/missing",
        statusCode: 404,
        errorCode: "ROUTE_NOT_FOUND",
      }
    );
    assert.match(entries[0].timestamp, /^\d{4}-\d{2}-\d{2}T/);
    assert.ok(entries[0].durationMs >= 0);
  });

  it("returns a safe validation error for malformed JSON", async () => {
    const response = await request(buildApp())
      .post("/missing")
      .set("Content-Type", "application/json")
      .send('{"incomplete"')
      .expect(400);

    assert.deepEqual(response.body, {
      error: {
        code: "INVALID_REQUEST_BODY",
        message: "The request body is not valid JSON",
        requestId: "test-request-id",
      },
    });
  });

  it("rejects request bodies larger than 16 KB", async () => {
    const response = await request(buildApp())
      .post("/missing")
      .send({ payload: "x".repeat(17 * 1024) })
      .expect(413);

    assert.equal(response.body.error.code, "REQUEST_BODY_TOO_LARGE");
    assert.equal(response.body.error.requestId, "test-request-id");
  });

  it("rejects excessive form parameters", async () => {
    const form = new URLSearchParams(
      Array.from({ length: 51 }, (_, index) => [`field${index}`, "value"])
    );
    const response = await request(buildApp())
      .post("/missing")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .send(form.toString())
      .expect(413);

    assert.equal(response.body.error.code, "TOO_MANY_PARAMETERS");
    assert.equal(response.body.error.requestId, "test-request-id");
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
        requestId: "test-request-id",
      },
    });
  });
});
