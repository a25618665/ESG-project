const AppError = require("../errors/AppError");

const READINESS_SQL = "SELECT 1::integer AS ready";

function createReadinessService(database) {
  if (!database || typeof database.one !== "function") {
    throw new TypeError("A database client with a one() method is required");
  }

  return {
    async checkReadiness() {
      try {
        const result = await database.one(READINESS_SQL);
        if (!result || result.ready !== 1) {
          throw new Error("Unexpected database readiness response");
        }

        return {
          status: "ready",
          service: "esg-api",
          dependencies: { database: "up" },
        };
      } catch (error) {
        throw new AppError(
          "Service dependencies are unavailable",
          503,
          "SERVICE_NOT_READY"
        );
      }
    },
  };
}

module.exports = { READINESS_SQL, createReadinessService };
