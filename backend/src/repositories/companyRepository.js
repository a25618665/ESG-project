const LIST_COMPANIES_SQL = "SELECT * FROM company";

function createCompanyRepository(database) {
  if (!database || typeof database.any !== "function") {
    throw new TypeError("A database client with an any() method is required");
  }

  return {
    findAll() {
      return database.any(LIST_COMPANIES_SQL);
    },
  };
}

module.exports = { createCompanyRepository, LIST_COMPANIES_SQL };
