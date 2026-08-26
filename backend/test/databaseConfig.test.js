const assert = require("assert").strict;

const { readDatabaseConfig } = require("../src/config/database");

describe("database configuration", () => {
  const validEnvironment = {
    DB_HOST: "localhost",
    DB_PORT: "5432",
    DB_NAME: "esg",
    DB_USER: "postgres",
    DB_PASSWORD: "test-password",
    DB_SSL: "false",
  };

  it("maps environment variables into database options", () => {
    assert.deepEqual(readDatabaseConfig(validEnvironment), {
      host: "localhost",
      port: 5432,
      database: "esg",
      user: "postgres",
      password: "test-password",
      ssl: false,
    });
  });

  it("requires every database setting", () => {
    const environment = { ...validEnvironment };
    delete environment.DB_PASSWORD;

    assert.throws(
      () => readDatabaseConfig(environment),
      /Missing required database configuration: DB_PASSWORD/
    );
  });

  it("rejects an invalid database port", () => {
    assert.throws(
      () => readDatabaseConfig({ ...validEnvironment, DB_PORT: "invalid" }),
      /DB_PORT must be a positive integer/
    );
  });

  it("enables PostgreSQL SSL explicitly", () => {
    assert.deepEqual(
      readDatabaseConfig({ ...validEnvironment, DB_SSL: "true" }).ssl,
      { rejectUnauthorized: false }
    );
  });
});
