const assert = require("assert").strict;

const contract = require("../openapi.json");

const EXPECTED_PATHS = [
  "/",
  "/api/companies",
  "/api/risk-events",
  "/api/risk-summary",
  "/company",
  "/health",
  "/openapi.json",
  "/ready",
];

function collectReferences(value, references = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectReferences(item, references));
    return references;
  }

  if (!value || typeof value !== "object") return references;
  if (typeof value.$ref === "string") references.push(value.$ref);
  Object.values(value).forEach((item) => collectReferences(item, references));
  return references;
}

function resolveLocalReference(reference) {
  assert.match(reference, /^#\//, `Only local references are supported: ${reference}`);
  return reference
    .slice(2)
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))
    .reduce((value, part) => value && value[part], contract);
}

describe("OpenAPI contract", () => {
  it("declares an OpenAPI 3.1 service contract", () => {
    assert.equal(contract.openapi, "3.1.0");
    assert.equal(contract.info.title, "ESG Analytics API");
    assert.match(contract.info.version, /^\d+\.\d+\.\d+$/);
  });

  it("documents every public GET endpoint with stable operation IDs", () => {
    assert.deepEqual(Object.keys(contract.paths).sort(), EXPECTED_PATHS);

    const operationIds = new Set();
    for (const [path, pathItem] of Object.entries(contract.paths)) {
      assert.deepEqual(Object.keys(pathItem), ["get"], `${path} must be GET-only`);
      assert.ok(pathItem.get.summary, `${path} needs a summary`);
      assert.ok(pathItem.get.responses["200"], `${path} needs a 200 response`);
      assert.ok(pathItem.get.operationId, `${path} needs an operationId`);
      assert.equal(
        operationIds.has(pathItem.get.operationId),
        false,
        `${pathItem.get.operationId} must be unique`
      );
      operationIds.add(pathItem.get.operationId);
    }
  });

  it("matches the implemented risk-event query boundaries", () => {
    const parameters = contract.paths["/api/risk-events"].get.parameters.map(
      ({ $ref }) => resolveLocalReference($ref)
    );
    const byName = Object.fromEntries(
      parameters.map((parameter) => [parameter.name, parameter.schema])
    );

    assert.deepEqual(Object.keys(byName).sort(), [
      "companyCode",
      "grade",
      "limit",
      "majorClass",
      "offset",
    ]);
    assert.deepEqual(byName.grade.enum, ["3", "4", "5", "6", "7", "8", "9", "D"]);
    assert.equal(byName.companyCode.pattern, "^[0-9]{6}$");
    assert.deepEqual(
      { minimum: byName.limit.minimum, maximum: byName.limit.maximum, default: byName.limit.default },
      { minimum: 1, maximum: 100, default: 20 }
    );
    assert.deepEqual(
      { minimum: byName.offset.minimum, maximum: byName.offset.maximum, default: byName.offset.default },
      { minimum: 0, maximum: 10000, default: 0 }
    );
  });

  it("marks the backward-compatible company route as deprecated", () => {
    const legacyOperation = contract.paths["/company"].get;
    assert.equal(legacyOperation.deprecated, true);
    assert.match(legacyOperation.description, /migrate to \/api\/companies/);
  });

  it("resolves every schema, parameter, and response reference", () => {
    const references = collectReferences(contract);
    assert.ok(references.length > 0);
    for (const reference of references) {
      assert.ok(resolveLocalReference(reference), `Unresolved reference: ${reference}`);
    }
  });
});
