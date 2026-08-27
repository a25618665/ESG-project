const express = require("express");

function createRiskRouter(riskController) {
  const router = express.Router();
  router.get("/", riskController.summary);
  return router;
}

module.exports = { createRiskRouter };
