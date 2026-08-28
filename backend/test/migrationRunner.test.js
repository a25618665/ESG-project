const assert = require("node:assert/strict");
const path = require("node:path");

const {
  CREATE_MIGRATION_TABLE_SQL,
  RECORD_MIGRATION_SQL,
  calculateMigrationChecksum,
  discoverMigrations,
  resolveMigrationsDirectory,
  runMigrations,
  validateMigrationHistory,
} = require("../src/database/migrationRunner");

function createMigrationSource(files) {
  return {
    migrationsDirectory: "migrations",
    readDirectory: async () => Object.keys(files),
    readFile: async (filename) => files[path.basename(filename)],
  };
}

function createDatabaseHarness({ appliedMigrations = [], failOnSql } = {}) {
  const calls = [];
  const connection = {
    async one(sql, values) {
      calls.push({ method: "one", sql, values });
      return sql.includes("unlock") ? { released: true } : { acquired: null };
    },
    async none(sql, values) {
      calls.push({ method: "none", sql, values });
    },
    async any(sql) {
      calls.push({ method: "any", sql });
      return appliedMigrations;
    },
    async tx(callback) {
      calls.push({ method: "tx" });
      return callback({
        async none(sql, values) {
          calls.push({ method: "tx.none", sql, values });
          if (sql === failOnSql) {
            throw new Error("migration execution failed");
          }
        },
      });
    },
  };

  return {
    calls,
    database: {
      async task(callback) {
        return callback(connection);
      },
    },
  };
}

describe("database migration runner", () => {
  it("resolves an explicit migration directory", () => {
    assert.equal(
      resolveMigrationsDirectory({ MIGRATIONS_DIR: "./custom-migrations" }),
      path.resolve("./custom-migrations"),
    );
  });

  it("discovers all tracked repository migrations", async () => {
    const migrations = await discoverMigrations({
      migrationsDirectory: resolveMigrationsDirectory({}),
    });

    assert.deepEqual(
      migrations.map(({ version }) => version),
      ["001", "002", "003", "004", "005"],
    );
  });

  it("produces the same checksum for Windows and Linux line endings", () => {
    assert.equal(
      calculateMigrationChecksum("001_first.sql", "SELECT 1;\r\nSELECT 2;\r\n"),
      calculateMigrationChecksum("001_first.sql", "SELECT 1;\nSELECT 2;\n"),
    );
  });

  it("discovers migrations in version order with stable checksums", async () => {
    const source = createMigrationSource({
      "002_second.sql": "SELECT 2;",
      "001_first.sql": "SELECT 1;",
      "notes.txt": "ignored",
    });

    const migrations = await discoverMigrations(source);

    assert.deepEqual(
      migrations.map(({ version, name, filename }) => ({
        version,
        name,
        filename,
      })),
      [
        { version: "001", name: "first", filename: "001_first.sql" },
        { version: "002", name: "second", filename: "002_second.sql" },
      ],
    );
    assert.match(migrations[0].checksum, /^[a-f0-9]{64}$/);
    assert.notEqual(migrations[0].checksum, migrations[1].checksum);
  });

  it("rejects malformed migration filenames", async () => {
    await assert.rejects(
      discoverMigrations(
        createMigrationSource({ "1-Initial Schema.sql": "SELECT 1;" }),
      ),
      /expected NNN_lowercase_name\.sql/,
    );
  });

  it("rejects empty migration files", async () => {
    await assert.rejects(
      discoverMigrations(createMigrationSource({ "001_empty.sql": "  " })),
      /Migration 001_empty\.sql is empty/,
    );
  });

  it("applies each pending migration transactionally and records it", async () => {
    const source = createMigrationSource({
      "001_first.sql": "SELECT 1;",
      "002_second.sql": "SELECT 2;",
    });
    const { calls, database } = createDatabaseHarness();
    const events = [];

    const result = await runMigrations({
      database,
      ...source,
      logEvent: (entry) => events.push(entry),
    });

    assert.deepEqual(result, {
      appliedCount: 2,
      skippedCount: 0,
      totalCount: 2,
    });
    assert.equal(
      calls.filter(({ method }) => method === "tx").length,
      2,
    );
    assert.equal(
      calls.filter(
        ({ method, sql }) => method === "tx.none" && sql === RECORD_MIGRATION_SQL,
      ).length,
      2,
    );
    assert.ok(
      calls.some(
        ({ method, sql }) =>
          method === "none" && sql === CREATE_MIGRATION_TABLE_SQL,
      ),
    );
    assert.deepEqual(
      events.map(({ event }) => event),
      [
        "database_migration_applied",
        "database_migration_applied",
        "database_migrations_completed",
      ],
    );
  });

  it("skips migrations whose recorded checksums still match", async () => {
    const source = createMigrationSource({ "001_first.sql": "SELECT 1;" });
    const [migration] = await discoverMigrations(source);
    const { calls, database } = createDatabaseHarness({
      appliedMigrations: [migration],
    });

    const result = await runMigrations({
      database,
      ...source,
      logEvent: () => {},
    });

    assert.deepEqual(result, {
      appliedCount: 0,
      skippedCount: 1,
      totalCount: 1,
    });
    assert.equal(
      calls.filter(({ method }) => method === "tx").length,
      0,
    );
  });

  it("rejects changed or missing migrations from recorded history", async () => {
    const source = createMigrationSource({ "001_first.sql": "SELECT 1;" });
    const [migration] = await discoverMigrations(source);

    assert.throws(
      () =>
        validateMigrationHistory([migration], [
          { ...migration, checksum: "0".repeat(64) },
        ]),
      /no longer matches its recorded checksum/,
    );
    assert.throws(
      () =>
        validateMigrationHistory([], [
          { version: "001", name: "first", checksum: migration.checksum },
        ]),
      /Applied migration 001_first\.sql is missing/,
    );
  });

  it("releases the advisory lock when a migration fails", async () => {
    const source = createMigrationSource({ "001_first.sql": "SELECT 1;" });
    const { calls, database } = createDatabaseHarness({
      failOnSql: "SELECT 1;",
    });

    await assert.rejects(
      runMigrations({ database, ...source, logEvent: () => {} }),
      /migration execution failed/,
    );

    assert.ok(
      calls.some(
        ({ method, sql }) => method === "one" && sql.includes("unlock"),
      ),
    );
  });
});
