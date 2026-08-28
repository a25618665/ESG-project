const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");

describe("risk data seed", () => {
  it("contains 188 complete SQL tuples", () => {
    const seedPath = path.join(
      __dirname,
      "..",
      "..",
      "database",
      "init",
      "004_risk_data.sql"
    );
    const sql = fs.readFileSync(seedPath, "utf8");
    const sourceData = sql.match(
      /WITH source_data[\s\S]+?VALUES\s*\r?\n([\s\S]+?)\r?\n\)\r?\nINSERT INTO risk_event/
    );

    assert.ok(sourceData, "source_data VALUES block must be present");

    const tuples = sourceData[1]
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    assert.equal(tuples.length, 188);
    tuples.forEach((tuple, index) => {
      const expectedEnding = index === tuples.length - 1 ? ")" : "),";
      assert.ok(
        tuple.startsWith("(") && tuple.endsWith(expectedEnding),
        `risk tuple ${index + 1} must be fully parenthesized`
      );
    });
  });
});
