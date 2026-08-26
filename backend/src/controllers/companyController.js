function createCompanyController(companyService) {
  async function loadCompanies(next) {
    try {
      return await companyService.listCompanies();
    } catch (error) {
      next(error);
      return null;
    }
  }

  return {
    async list(req, res, next) {
      const companies = await loadCompanies(next);
      if (companies === null) return;

      res.json({
        data: companies,
        meta: { count: companies.length },
      });
    },

    async listLegacy(req, res, next) {
      const companies = await loadCompanies(next);
      if (companies === null) return;

      res.json(companies);
    },
  };
}

module.exports = { createCompanyController };
