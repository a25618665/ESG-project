const AppError = require("../errors/AppError");

function createCompanyService(companyRepository) {
  if (!companyRepository || typeof companyRepository.findAll !== "function") {
    throw new TypeError("A company repository with a findAll() method is required");
  }

  return {
    async listCompanies() {
      try {
        const companies = await companyRepository.findAll();

        if (!Array.isArray(companies)) {
          throw new AppError(
            "The database returned an invalid company collection",
            500,
            "INVALID_COMPANY_DATA"
          );
        }

        return companies;
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }

        throw new AppError(
          "Company data is temporarily unavailable",
          503,
          "COMPANY_DATA_UNAVAILABLE"
        );
      }
    },
  };
}

module.exports = { createCompanyService };
