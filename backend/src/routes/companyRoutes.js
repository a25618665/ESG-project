const express = require("express");

function createCompanyRouter(companyController) {
  const router = express.Router();
  router.get("/", companyController.list);
  return router;
}

module.exports = { createCompanyRouter };
