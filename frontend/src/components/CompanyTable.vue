<template>
  <section class="company-panel" aria-labelledby="company-heading">
    <div class="panel-heading">
      <div>
        <p class="eyebrow">PostgreSQL records</p>
        <h2 id="company-heading">Companies</h2>
      </div>
      <span v-if="!loading && !errorMessage" class="count">
        {{ companies.length }} records
      </span>
    </div>

    <p v-if="loading" class="status" role="status">Loading company data…</p>
    <div v-else-if="errorMessage" class="status error" role="alert">
      <p>{{ errorMessage }}</p>
      <p v-if="errorReference" class="error-reference">
        Reference: <code>{{ errorReference }}</code>
      </p>
      <button type="button" @click="loadCompanies">Retry</button>
    </div>
    <p v-else-if="companies.length === 0" class="status">
      No company records are available.
    </p>

    <div v-else class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th scope="col">Company ID</th>
            <th scope="col">Company name</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="company in companies" :key="company.id || company.name">
            <td>{{ company.id }}</td>
            <td>{{ company.name }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script>
import { extractRequestId, getApi } from "../api/client";

export default {
  name: "CompanyTable",
  data() {
    return {
      companies: [],
      errorMessage: "",
      errorReference: "",
      loading: true,
    };
  },
  created() {
    this.loadCompanies();
  },
  methods: {
    async loadCompanies() {
      this.loading = true;
      this.errorMessage = "";
      this.errorReference = "";

      try {
        const response = await getApi("/api/companies");
        if (!Array.isArray(response.data.data)) {
          throw new Error("Invalid API response");
        }
        this.companies = response.data.data;
      } catch (error) {
        this.companies = [];
        this.errorMessage = "Company data is temporarily unavailable.";
        this.errorReference = extractRequestId(error);
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style scoped>
.company-panel {
  background: #ffffff;
  border: 1px solid #dfe7e2;
  border-radius: 14px;
  box-shadow: 0 16px 40px rgba(28, 73, 51, 0.08);
  overflow: hidden;
}

.panel-heading {
  align-items: center;
  display: flex;
  justify-content: space-between;
  padding: 24px 28px;
}

.eyebrow {
  color: #4c7b5d;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  margin: 0 0 6px;
  text-transform: uppercase;
}

h2 {
  color: #173c29;
  font-size: 1.5rem;
  margin: 0;
}

.count {
  background: #e8f4ec;
  border-radius: 999px;
  color: #2f6844;
  font-size: 0.85rem;
  font-weight: 700;
  padding: 7px 12px;
}

.status {
  border-top: 1px solid #e8eeea;
  color: #52615a;
  margin: 0;
  padding: 28px;
}

.error {
  color: #a33a3a;
}

.error p {
  margin: 0 0 10px;
}

.error-reference {
  font-size: 0.78rem;
}

.error button {
  background: #ffffff;
  border: 1px solid #c98787;
  border-radius: 7px;
  color: #8c2f2f;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  padding: 8px 12px;
}

.table-wrapper {
  overflow-x: auto;
}

table {
  border-collapse: collapse;
  width: 100%;
}

th,
td {
  border-top: 1px solid #e8eeea;
  padding: 15px 28px;
  text-align: left;
}

th {
  background: #f6faf7;
  color: #446052;
  font-size: 0.78rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

td {
  color: #273b31;
}
</style>
