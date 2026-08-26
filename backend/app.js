const express = require("express");
const logger = require("morgan");

const { createDatabase } = require("./src/config/database");
const {
  createCompanyRepository,
} = require("./src/repositories/companyRepository");
const { createCompanyService } = require("./src/services/companyService");
const {
  createCompanyController,
} = require("./src/controllers/companyController");
const { createCompanyRouter } = require("./src/routes/companyRoutes");
const { errorHandler, notFound } = require("./src/middleware/errorHandler");

function createDefaultCompanyService() {
  const database = createDatabase();
  const repository = createCompanyRepository(database);
  return createCompanyService(repository);
}

function createApp(options = {}) {
  const app = express();
  const environment = options.environment || process.env.NODE_ENV || "development";
  const corsOrigin =
    options.corsOrigin || process.env.CORS_ORIGIN || "http://localhost:8080";
  const companyService =
    options.companyService || createDefaultCompanyService();
  const companyController = createCompanyController(companyService);

  app.set("env", environment);

  if (environment !== "test") {
    app.use(logger("dev"));
  }

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use((req, res, next) => {
    const requestOrigin = req.get("Origin");

    res.vary("Origin");
    res.set("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type,Authorization");

    if (!requestOrigin || requestOrigin === corsOrigin) {
      res.set("Access-Control-Allow-Origin", corsOrigin);
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }

    next();
  });

  app.get("/", (req, res) => {
    res.json({
      name: "ESG Analytics API",
      endpoints: {
        health: "/health",
        companies: "/api/companies",
        legacyCompanies: "/company",
      },
    });
  });

  app.get("/health", (req, res) => {
    res.json({ status: "ok", service: "esg-api" });
  });

  app.use("/api/companies", createCompanyRouter(companyController));

  // Preserve the original frontend contract while clients migrate to /api/companies.
  app.get("/company", companyController.listLegacy);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
