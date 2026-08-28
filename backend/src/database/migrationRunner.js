const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const MIGRATION_FILENAME_PATTERN = /^(?<version>\d{3})_(?<name>[a-z0-9_]+)\.sql$/;
const MIGRATION_LOCK_ID = 20_230_523;

const CREATE_MIGRATION_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version CHAR(3) PRIMARY KEY CHECK (version ~ '^[0-9]{3}$'),
  name TEXT NOT NULL,
  checksum CHAR(64) NOT NULL CHECK (checksum ~ '^[a-f0-9]{64}$'),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

const LIST_APPLIED_MIGRATIONS_SQL = `
SELECT version, name, checksum
FROM schema_migrations
ORDER BY version`;

const RECORD_MIGRATION_SQL = `
INSERT INTO schema_migrations (version, name, checksum)
VALUES ($1, $2, $3)`;

function defaultMigrationLogger(entry) {
  console.info(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      ...entry,
    }),
  );
}

function resolveMigrationsDirectory(environment = process.env) {
  return environment.MIGRATIONS_DIR
    ? path.resolve(environment.MIGRATIONS_DIR)
    : path.resolve(__dirname, "..", "..", "..", "database", "init");
}

function calculateMigrationChecksum(filename, sql) {
  const normalizedSql = sql.replace(/\r\n?/g, "\n");
  return crypto
    .createHash("sha256")
    .update(filename)
    .update("\0")
    .update(normalizedSql)
    .digest("hex");
}

async function discoverMigrations({
  migrationsDirectory,
  readDirectory = fs.readdir,
  readFile = fs.readFile,
} = {}) {
  if (!migrationsDirectory) {
    throw new TypeError("A migrations directory is required");
  }

  const filenames = (await readDirectory(migrationsDirectory))
    .filter((filename) => filename.endsWith(".sql"))
    .sort();

  if (filenames.length === 0) {
    throw new Error(`No SQL migrations found in ${migrationsDirectory}`);
  }

  const migrations = [];
  const versions = new Set();

  for (const filename of filenames) {
    const match = MIGRATION_FILENAME_PATTERN.exec(filename);
    if (!match) {
      throw new Error(
        `Invalid migration filename ${filename}; expected NNN_lowercase_name.sql`,
      );
    }

    const { version, name } = match.groups;
    if (versions.has(version)) {
      throw new Error(`Duplicate migration version ${version}`);
    }
    versions.add(version);

    const sql = await readFile(path.join(migrationsDirectory, filename), "utf8");
    if (!sql.trim()) {
      throw new Error(`Migration ${filename} is empty`);
    }

    migrations.push({
      version,
      name,
      filename,
      sql,
      checksum: calculateMigrationChecksum(filename, sql),
    });
  }

  return migrations;
}

function validateMigrationHistory(migrations, appliedMigrations) {
  const discoveredByVersion = new Map(
    migrations.map((migration) => [migration.version, migration]),
  );
  const appliedByVersion = new Map(
    appliedMigrations.map((migration) => [migration.version, migration]),
  );

  for (const applied of appliedMigrations) {
    const discovered = discoveredByVersion.get(applied.version);
    if (!discovered) {
      throw new Error(
        `Applied migration ${applied.version}_${applied.name}.sql is missing`,
      );
    }
    if (
      discovered.name !== applied.name ||
      discovered.checksum !== applied.checksum
    ) {
      throw new Error(
        `Applied migration ${discovered.filename} no longer matches its recorded checksum`,
      );
    }
  }

  return appliedByVersion;
}

async function runMigrations({
  database,
  migrationsDirectory = resolveMigrationsDirectory(),
  readDirectory,
  readFile,
  logEvent = defaultMigrationLogger,
} = {}) {
  if (!database || typeof database.task !== "function") {
    throw new TypeError("A database client with a task() method is required");
  }

  const migrations = await discoverMigrations({
    migrationsDirectory,
    readDirectory,
    readFile,
  });

  return database.task(async (connection) => {
    await connection.one(
      "SELECT pg_advisory_lock($1) AS acquired",
      MIGRATION_LOCK_ID,
    );

    try {
      await connection.none(CREATE_MIGRATION_TABLE_SQL);
      const appliedMigrations = await connection.any(
        LIST_APPLIED_MIGRATIONS_SQL,
      );
      const appliedByVersion = validateMigrationHistory(
        migrations,
        appliedMigrations,
      );
      let appliedCount = 0;

      for (const migration of migrations) {
        if (appliedByVersion.has(migration.version)) {
          continue;
        }

        await connection.tx(async (transaction) => {
          await transaction.none(migration.sql);
          await transaction.none(RECORD_MIGRATION_SQL, [
            migration.version,
            migration.name,
            migration.checksum,
          ]);
        });

        appliedCount += 1;
        logEvent({
          event: "database_migration_applied",
          level: "info",
          version: migration.version,
          name: migration.name,
        });
      }

      const result = {
        appliedCount,
        skippedCount: migrations.length - appliedCount,
        totalCount: migrations.length,
      };
      logEvent({
        event: "database_migrations_completed",
        level: "info",
        ...result,
      });

      return result;
    } finally {
      await connection.one(
        "SELECT pg_advisory_unlock($1) AS released",
        MIGRATION_LOCK_ID,
      );
    }
  });
}

module.exports = {
  CREATE_MIGRATION_TABLE_SQL,
  LIST_APPLIED_MIGRATIONS_SQL,
  MIGRATION_FILENAME_PATTERN,
  MIGRATION_LOCK_ID,
  RECORD_MIGRATION_SQL,
  calculateMigrationChecksum,
  defaultMigrationLogger,
  discoverMigrations,
  resolveMigrationsDirectory,
  runMigrations,
  validateMigrationHistory,
};
