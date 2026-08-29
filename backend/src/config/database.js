const pgPromise = require("pg-promise");

const REQUIRED_DATABASE_VARIABLES = [
  "DB_HOST",
  "DB_PORT",
  "DB_NAME",
  "DB_USER",
  "DB_PASSWORD",
];

function readDatabaseConfig(environment = process.env) {
  const missingVariables = REQUIRED_DATABASE_VARIABLES.filter(
    (variable) => !environment[variable]
  );

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing required database configuration: ${missingVariables.join(", ")}`
    );
  }

  const port = Number(environment.DB_PORT);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("DB_PORT must be a positive integer");
  }

  return {
    host: environment.DB_HOST,
    port,
    database: environment.DB_NAME,
    user: environment.DB_USER,
    password: environment.DB_PASSWORD,
    ssl:
      environment.DB_SSL === "true"
        ? { rejectUnauthorized: false }
        : false,
  };
}

function createDatabase(environment = process.env) {
  const pgp = pgPromise();
  return pgp(readDatabaseConfig(environment));
}

async function closeDatabase(database) {
  if (!database?.$pool || typeof database.$pool.end !== "function") {
    throw new TypeError(
      "A database client with a closable connection pool is required"
    );
  }

  await database.$pool.end();
}

module.exports = { closeDatabase, createDatabase, readDatabaseConfig };
