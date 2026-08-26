const assert = require("assert").strict;

const {
  createCompanyRepository,
  LIST_COMPANIES_SQL,
} = require("../src/repositories/companyRepository");

describe("company repository", () => {
  it("reads all companies through the injected database client", async () => {
    const expected = [{ id: 1, name: "Alpha" }];
    let executedSql;
    const database = {
      async any(sql) {
        executedSql = sql;
        return expected;
      },
    };
    const repository = createCompanyRepository(database);

    assert.deepEqual(await repository.findAll(), expected);
    assert.equal(executedSql, LIST_COMPANIES_SQL);
  });

  it("rejects an incompatible database client", () => {
    assert.throws(
      () => createCompanyRepository({}),
      /database client with an any\(\) method is required/
    );
  });
});
