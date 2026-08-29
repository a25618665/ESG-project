<template>
  <section class="event-panel" aria-labelledby="event-heading">
    <div class="panel-heading">
      <div>
        <p class="eyebrow">Indexed PostgreSQL query</p>
        <h2 id="event-heading">Risk event explorer</h2>
      </div>
      <span v-if="!loading && !errorMessage" class="count">
        {{ meta.total }} matching events
      </span>
    </div>

    <form class="filters" aria-label="Risk event filters" @submit.prevent="applyFilters">
      <label>
        CCRI grade
        <select v-model="filters.grade">
          <option value="">All grades</option>
          <option v-for="grade in grades" :key="grade" :value="grade">
            {{ grade }}
          </option>
        </select>
      </label>
      <label>
        Major class
        <select v-model="filters.majorClass">
          <option value="">All classes</option>
          <option v-for="item in majorClasses" :key="item" :value="item">
            {{ item }}
          </option>
        </select>
      </label>
      <label>
        Company code
        <input
          v-model.trim="filters.companyCode"
          inputmode="numeric"
          maxlength="6"
          pattern="[0-9]{6}"
          placeholder="e.g. 002628"
        />
      </label>
      <div class="filter-actions">
        <button class="primary" type="submit">Apply filters</button>
        <button type="button" @click="clearFilters">Clear</button>
      </div>
    </form>

    <p v-if="loading" class="status" role="status">Loading risk events…</p>
    <div v-else-if="errorMessage" class="status error" role="alert">
      <p>{{ errorMessage }}</p>
      <p v-if="errorReference" class="error-reference">
        Reference: <code>{{ errorReference }}</code>
      </p>
      <button type="button" @click="loadEvents">Retry</button>
    </div>
    <p v-else-if="events.length === 0" class="status">
      No risk events match these filters.
    </p>

    <template v-else>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th scope="col">Company</th>
              <th scope="col">Date</th>
              <th scope="col">Grade</th>
              <th scope="col">Major class</th>
              <th scope="col">Subcategory</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="event in events" :key="event.id">
              <td>
                <strong>{{ event.companyName }}</strong>
                <span>{{ event.companyCode }}</span>
              </td>
              <td>{{ event.eventDate }}</td>
              <td><span class="grade">{{ event.ccriGrade }}</span></td>
              <td>{{ event.majorClass }}</td>
              <td>{{ event.subcategory }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <nav class="pagination" aria-label="Risk event pages">
        <button type="button" :disabled="meta.offset === 0" @click="previousPage">
          Previous
        </button>
        <span>
          {{ meta.offset + 1 }}–{{ meta.offset + meta.count }} of {{ meta.total }}
        </span>
        <button type="button" :disabled="!hasNextPage" @click="nextPage">
          Next
        </button>
      </nav>
    </template>
  </section>
</template>

<script>
import {
  extractRequestId,
  getApi,
  isCanceledRequest,
} from "../api/client";

const eventFields = [
  "companyCode",
  "companyName",
  "eventDate",
  "eventCode",
  "ccriGrade",
  "dataPeriod",
  "majorClass",
  "subcategory",
];

function isRiskEvent(event) {
  return (
    event &&
    Number.isInteger(event.id) &&
    Number.isInteger(event.sourceRow) &&
    eventFields.every((field) => typeof event[field] === "string")
  );
}

function isEventResponse(payload) {
  const meta = payload && payload.meta;
  return (
    payload &&
    Array.isArray(payload.data) &&
    payload.data.every(isRiskEvent) &&
    meta &&
    ["total", "count", "limit", "offset"].every(
      (field) => Number.isInteger(meta[field]) && meta[field] >= 0,
    ) &&
    meta.count === payload.data.length
  );
}

export default {
  name: "RiskEventExplorer",
  data() {
    return {
      events: [],
      activeRequestController: null,
      errorMessage: "",
      errorReference: "",
      filters: { grade: "", majorClass: "", companyCode: "" },
      appliedFilters: { grade: "", majorClass: "", companyCode: "" },
      grades: ["3", "4", "5", "6", "7", "8", "9", "D"],
      majorClasses: ["公司治理問題", "營運風險上升", "財務面問題"],
      loading: true,
      meta: { total: 0, count: 0, limit: 10, offset: 0 },
    };
  },
  computed: {
    hasNextPage() {
      return this.meta.offset + this.meta.count < this.meta.total;
    },
  },
  created() {
    this.loadEvents();
  },
  beforeUnmount() {
    const controller = this.activeRequestController;
    this.activeRequestController = null;
    controller?.abort();
  },
  methods: {
    async loadEvents() {
      this.activeRequestController?.abort();
      const controller = new AbortController();
      this.activeRequestController = controller;
      this.loading = true;
      this.errorMessage = "";
      this.errorReference = "";
      const params = {
        limit: this.meta.limit,
        offset: this.meta.offset,
        ...Object.fromEntries(
          Object.entries(this.appliedFilters).filter(([, value]) => value),
        ),
      };

      try {
        const response = await getApi("/api/risk-events", {
          params,
          signal: controller.signal,
        });
        if (this.activeRequestController !== controller) return;
        if (!isEventResponse(response.data)) throw new Error("Invalid API response");
        this.events = response.data.data;
        this.meta = response.data.meta;
      } catch (error) {
        if (
          this.activeRequestController !== controller ||
          isCanceledRequest(error)
        ) {
          return;
        }
        this.events = [];
        this.errorMessage = "Risk events are temporarily unavailable.";
        this.errorReference = extractRequestId(error);
      } finally {
        if (this.activeRequestController === controller) {
          this.activeRequestController = null;
          this.loading = false;
        }
      }
    },
    applyFilters() {
      this.appliedFilters = { ...this.filters };
      this.meta.offset = 0;
      return this.loadEvents();
    },
    clearFilters() {
      this.filters = { grade: "", majorClass: "", companyCode: "" };
      return this.applyFilters();
    },
    nextPage() {
      if (!this.hasNextPage) return;
      this.meta.offset += this.meta.limit;
      return this.loadEvents();
    },
    previousPage() {
      if (this.meta.offset === 0) return;
      this.meta.offset = Math.max(0, this.meta.offset - this.meta.limit);
      return this.loadEvents();
    },
  },
};
</script>

<style scoped>
.event-panel {
  background: #ffffff;
  border: 1px solid #dfe7e2;
  border-radius: 14px;
  box-shadow: 0 16px 40px rgba(28, 73, 51, 0.08);
  overflow: hidden;
}

.panel-heading,
.filters,
.pagination {
  align-items: center;
  display: flex;
}

.panel-heading {
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

.count,
.grade {
  background: #e8f4ec;
  border-radius: 999px;
  color: #2f6844;
  font-weight: 700;
}

.count {
  font-size: 0.85rem;
  padding: 7px 12px;
}

.filters {
  background: #f6faf7;
  border-top: 1px solid #e8eeea;
  flex-wrap: wrap;
  gap: 14px;
  padding: 18px 28px;
}

.filters label {
  color: #52665b;
  display: grid;
  font-size: 0.75rem;
  font-weight: 700;
  gap: 6px;
}

input,
select,
button {
  border: 1px solid #cddbd2;
  border-radius: 7px;
  font: inherit;
  padding: 9px 11px;
}

input,
select {
  background: #ffffff;
  color: #253c30;
}

button {
  background: #ffffff;
  color: #315740;
  cursor: pointer;
  font-weight: 700;
}

button.primary {
  background: #2f6844;
  border-color: #2f6844;
  color: #ffffff;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.filter-actions {
  align-self: end;
  display: flex;
  gap: 8px;
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
  border-color: #c98787;
  color: #8c2f2f;
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
  padding: 14px 18px;
  text-align: left;
}

th {
  background: #f6faf7;
  color: #446052;
  font-size: 0.72rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

td {
  color: #273b31;
  font-size: 0.82rem;
}

td strong,
td span {
  display: block;
}

td > span:not(.grade) {
  color: #718078;
  font-size: 0.72rem;
  margin-top: 4px;
}

.grade {
  display: inline-block;
  min-width: 28px;
  padding: 5px 8px;
  text-align: center;
}

.pagination {
  border-top: 1px solid #e8eeea;
  justify-content: flex-end;
  gap: 14px;
  padding: 16px 28px;
}

.pagination span {
  color: #64766c;
  font-size: 0.8rem;
}

@media (max-width: 640px) {
  .panel-heading {
    align-items: flex-start;
    gap: 12px;
  }

  .filters {
    align-items: stretch;
    display: grid;
  }

  .filter-actions {
    align-self: auto;
  }
}
</style>
