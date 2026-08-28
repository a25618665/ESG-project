const express = require("express");

function createRiskRouter(riskController) {
  const router = express.Router();
  router.get("/", riskController.summary);
  return router;
}

function createRiskEventRouter(riskController) {
  const router = express.Router();
  router.get("/", riskController.events);
  return router;
}

module.exports = { createRiskEventRouter, createRiskRouter };
