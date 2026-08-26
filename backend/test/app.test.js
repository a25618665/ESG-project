const assert = require("assert").strict;
const request = require("supertest");

const { createApp } = require("../app");
const AppError = require("../src/errors/AppError");

describe("ESG API", () => {
  const companies = [
    { id: 1, name: "Alpha" },
    { id: 2, name: "Beta" },
  ];

  function buildApp(listCompanies = async () => companies) {
    return createApp({
      companyService: { listCompanies },
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
