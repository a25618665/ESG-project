const assert = require("assert").strict;

const { createCompanyService } = require("../src/services/companyService");

describe("company service", () => {
  it("returns companies supplied by the repository", async () => {
    const expected = [{ id: 1, name: "Alpha" }];
    const service = createCompanyService({
      findAll: async () => expected,
    });

    assert.deepEqual(await service.listCompanies(), expected);
  });

  it("reuses validated company data within the cache TTL", async () => {
    let repositoryCalls = 0;
    const service = createCompanyService({
      findAll: async () => {
        repositoryCalls += 1;
        return [{ id: 1, name: "Alpha" }];
      },
    });

    await service.listCompanies();
    await service.listCompanies();

    assert.equal(repositoryCalls, 1);
  });

  it("converts database failures into an operational error", async () => {
    const service = createCompanyService({
      findAll: async () => {
        throw new Error("connection refused");
      },
    });

    await assert.rejects(service.listCompanies(), (error) => {
      assert.equal(error.statusCode, 503);
      assert.equal(error.code, "COMPANY_DATA_UNAVAILABLE");
      return true;
    });
  });

  it("rejects a non-array database response", async () => {
    const service = createCompanyService({
      findAll: async () => ({ company: "invalid" }),
    });

    await assert.rejects(service.listCompanies(), (error) => {
      assert.equal(error.statusCode, 500);
      assert.equal(error.code, "INVALID_COMPANY_DATA");
      return true;
    });
  });
});
