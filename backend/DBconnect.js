const pgp = require("pg-promise")();
require("dotenv").config();

const requiredVariables = [
  "DB_HOST",
  "DB_PORT",
  "DB_NAME",
  "DB_USER",
  "DB_PASSWORD",
];

const missingVariables = requiredVariables.filter(
  (variable) => !process.env[variable]
);

if (missingVariables.length > 0) {
  throw new Error(
    `Missing required database configuration: ${missingVariables.join(", ")}`
  );
}

const database = pgp({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl:
    process.env.DB_SSL === "true"
      ? { rejectUnauthorized: false }
      : false,
});

module.exports = database;
