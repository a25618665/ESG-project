const assert = require("assert").strict;

const {
  READINESS_SQL,
  createReadinessService,
} = require("../src/services/readinessService");

describe("readiness service", () => {
  it("requires a compatible database client", () => {
    assert.throws(
      () => createReadinessService({}),
      /database client with a one\(\) method/
    );
  });

  it("reports PostgreSQL readiness through the injected client", async () => {
    let receivedQuery;
    const service = createReadinessService({
      async one(query) {
        receivedQuery = query;
        return { ready: 1 };
      },
    });

    assert.deepEqual(await service.checkReadiness(), {
      status: "ready",
      service: "esg-api",
      dependencies: { database: "up" },
    });
    assert.equal(receivedQuery, READINESS_SQL);
  });

  it("rejects an unexpected database response", async () => {
    const service = createReadinessService({
      async one() {
        return { ready: 0 };
      },
    });

    await assert.rejects(service.checkReadiness(), (error) => {
      assert.equal(error.statusCode, 503);
      assert.equal(error.code, "SERVICE_NOT_READY");
      return true;
    });
  });

  it("converts database failures into a safe readiness error", async () => {
    const service = createReadinessService({
      async one() {
        throw new Error("database password and hostname details");
      },
    });

    await assert.rejects(service.checkReadiness(), (error) => {
      assert.equal(error.statusCode, 503);
      assert.equal(error.code, "SERVICE_NOT_READY");
      assert.equal(error.message, "Service dependencies are unavailable");
      return true;
    });
  });
});
