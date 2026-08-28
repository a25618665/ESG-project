const express = require("express");
const openApiDocument = require("./openapi.json");

const { createDatabase } = require("./src/config/database");
const {
  createCompanyRepository,
} = require("./src/repositories/companyRepository");
const { createCompanyService } = require("./src/services/companyService");
const {
  createCompanyController,
} = require("./src/controllers/companyController");
const { createCompanyRouter } = require("./src/routes/companyRoutes");
const { createRiskRepository } = require("./src/repositories/riskRepository");
const { createRiskService } = require("./src/services/riskService");
const {
  createReadinessService,
} = require("./src/services/readinessService");
const { createRiskController } = require("./src/controllers/riskController");
const {
  createRiskEventRouter,
  createRiskRouter,
} = require("./src/routes/riskRoutes");
const { errorHandler, notFound } = require("./src/middleware/errorHandler");
const {
  createRequestContext,
  defaultRequestLogger,
} = require("./src/middleware/requestContext");

function createDefaultServices() {
  const database = createDatabase();
  return {
    companyService: createCompanyService(createCompanyRepository(database)),
    riskService: createRiskService(createRiskRepository(database)),
    readinessService: createReadinessService(database),
  };
}

function createApp(options = {}) {
  const app = express();
  const environment = options.environment || process.env.NODE_ENV || "development";
  const corsOrigin =
    options.corsOrigin || process.env.CORS_ORIGIN || "http://localhost:8080";
  const defaultServices =
    options.companyService && options.riskService && options.readinessService
      ? {}
      : createDefaultServices();
  const companyService =
    options.companyService || defaultServices.companyService;
  const riskService = options.riskService || defaultServices.riskService;
  const readinessService =
    options.readinessService || defaultServices.readinessService;
  const companyController = createCompanyController(companyService);
  const riskController = createRiskController(riskService);
  let requestLogger = options.requestLogger;
  if (!Object.hasOwn(options, "requestLogger")) {
    requestLogger = environment === "test" ? null : defaultRequestLogger;
  }

  app.set("env", environment);
  app.use(
    createRequestContext({
      generateRequestId: options.requestIdFactory,
      logRequest: requestLogger,
    })
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use((req, res, next) => {
    const requestOrigin = req.get("Origin");

    res.vary("Origin");
    res.set("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.set(
      "Access-Control-Allow-Headers",
      "Content-Type,Authorization,X-Request-Id"
    );
    res.set("Access-Control-Expose-Headers", "X-Request-Id");

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
        readiness: "/ready",
        apiContract: "/openapi.json",
        companies: "/api/companies",
        riskSummary: "/api/risk-summary",
        riskEvents: "/api/risk-events",
        legacyCompanies: "/company",
      },
    });
  });

  app.get("/health", (req, res) => {
    res.json({ status: "ok", service: "esg-api" });
  });

  app.get("/ready", async (req, res, next) => {
    try {
      res.json(await readinessService.checkReadiness());
    } catch (error) {
      next(error);
    }
  });

  app.get("/openapi.json", (req, res) => {
    res.json(openApiDocument);
  });

  app.use("/api/companies", createCompanyRouter(companyController));
  app.use("/api/risk-summary", createRiskRouter(riskController));
  app.use("/api/risk-events", createRiskEventRouter(riskController));

  // Preserve the original frontend contract while clients migrate to /api/companies.
  app.get("/company", companyController.listLegacy);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
