<template>
  <section class="risk-panel" aria-labelledby="risk-heading">
    <div class="panel-heading">
      <div>
        <p class="eyebrow">CCRI research dataset</p>
        <h2 id="risk-heading">Risk analytics</h2>
      </div>
      <span v-if="summary && !loading && !errorMessage" class="dataset-state">
        Source verified
      </span>
    </div>

    <p v-if="loading" class="status" role="status">Loading risk analytics…</p>
    <div v-else-if="errorMessage" class="status error" role="alert">
      <p>{{ errorMessage }}</p>
      <p v-if="errorReference" class="error-reference">
        Reference: <code>{{ errorReference }}</code>
      </p>
      <button type="button" @click="loadSummary">Retry</button>
    </div>
    <p v-else-if="summary.eventCount === 0" class="status">
      No risk events are available.
    </p>

    <div v-else class="analytics-content">
      <dl class="metrics">
        <div>
          <dt>Risk events</dt>
          <dd>{{ summary.eventCount }}</dd>
        </div>
        <div>
          <dt>Companies</dt>
          <dd>{{ summary.companyCount }}</dd>
        </div>
        <div>
          <dt>Risk classes</dt>
          <dd>{{ summary.majorClassCount }}</dd>
        </div>
        <div>
          <dt>Subcategories</dt>
          <dd>{{ summary.subcategoryCount }}</dd>
        </div>
      </dl>

      <div class="distributions">
        <div>
          <div class="distribution-heading">
            <h3>CCRI grade distribution</h3>
            <span>{{ summary.numericGradeCount }} numeric grades</span>
          </div>
          <ul class="bars" aria-label="CCRI grade distribution">
            <li v-for="item in summary.gradeDistribution" :key="item.grade">
              <span class="bar-label">{{ item.grade }}</span>
              <span class="bar-track">
                <span
                  class="bar-fill grade-fill"
                  :style="{ width: barWidth(item.count, maxGradeCount) }"
                ></span>
              </span>
              <strong>{{ item.count }}</strong>
            </li>
          </ul>
          <p class="data-note">
            Includes {{ summary.specialGradeEventCount }} records carrying the
            source workbook’s special <strong>D</strong> code.
          </p>
        </div>

        <div>
          <div class="distribution-heading">
            <h3>Major risk classes</h3>
          </div>
          <ul class="bars class-bars" aria-label="Major risk class distribution">
            <li
              v-for="item in summary.classDistribution"
              :key="item.majorClass"
            >
              <span class="bar-label class-label">{{ item.majorClass }}</span>
              <span class="bar-track">
                <span
                  class="bar-fill class-fill"
                  :style="{ width: barWidth(item.count, maxClassCount) }"
                ></span>
              </span>
              <strong>{{ item.count }}</strong>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
import { extractRequestId, getApi } from "../api/client";

const metricNames = [
  "eventCount",
  "companyCount",
  "majorClassCount",
  "subcategoryCount",
  "numericGradeCount",
  "specialGradeEventCount",
];

function isDistribution(value, labelKey) {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item[labelKey] === "string" &&
        Number.isInteger(item.count) &&
        item.count >= 0,
    )
  );
}

function isRiskSummary(value) {
  return (
    value &&
    metricNames.every(
      (name) => Number.isInteger(value[name]) && value[name] >= 0,
    ) &&
    isDistribution(value.gradeDistribution, "grade") &&
    isDistribution(value.classDistribution, "majorClass")
  );
}

export default {
  name: "RiskSummary",
  data() {
    return {
      summary: null,
      errorMessage: "",
      errorReference: "",
      loading: true,
    };
  },
  computed: {
    maxGradeCount() {
      return Math.max(...this.summary.gradeDistribution.map(({ count }) => count), 1);
    },
    maxClassCount() {
      return Math.max(...this.summary.classDistribution.map(({ count }) => count), 1);
    },
  },
  created() {
    this.loadSummary();
  },
  methods: {
    async loadSummary() {
      this.loading = true;
      this.errorMessage = "";
      this.errorReference = "";

      try {
        const response = await getApi("/api/risk-summary");
        if (!isRiskSummary(response.data.data)) {
          throw new Error("Invalid API response");
        }
        this.summary = response.data.data;
      } catch (error) {
        this.summary = null;
        this.errorMessage = "Risk analytics are temporarily unavailable.";
        this.errorReference = extractRequestId(error);
      } finally {
        this.loading = false;
      }
    },
    barWidth(count, maximum) {
      return `${Math.round((count / maximum) * 100)}%`;
    },
  },
};
</script>

<style scoped>
.risk-panel {
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

h2,
h3 {
  color: #173c29;
  margin: 0;
}

h2 {
  font-size: 1.5rem;
}

h3 {
  font-size: 1rem;
}

.dataset-state {
  background: #e8f4ec;
  border-radius: 999px;
  color: #2f6844;
  font-size: 0.78rem;
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

.analytics-content {
  border-top: 1px solid #e8eeea;
  padding: 28px;
}

.metrics {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(4, 1fr);
  margin: 0 0 32px;
}

.metrics div {
  background: #f6faf7;
  border: 1px solid #e3ece6;
  border-radius: 10px;
  padding: 18px;
}

.metrics dt {
  color: #64766c;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.metrics dd {
  color: #1f5b38;
  font-size: 2rem;
  font-weight: 750;
  margin: 8px 0 0;
}

.distributions {
  display: grid;
  gap: 36px;
  grid-template-columns: 0.9fr 1.1fr;
}

.distribution-heading {
  align-items: baseline;
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
}

.distribution-heading span {
  color: #718078;
  font-size: 0.75rem;
}

.bars {
  display: grid;
  gap: 10px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.bars li {
  align-items: center;
  display: grid;
  font-size: 0.8rem;
  gap: 10px;
  grid-template-columns: 22px 1fr 28px;
}

.class-bars li {
  grid-template-columns: minmax(110px, 1fr) 1fr 30px;
}

.bar-label,
.bars strong {
  color: #43574c;
}

.class-label {
  line-height: 1.25;
}

.bar-track {
  background: #edf2ef;
  border-radius: 999px;
  display: block;
  height: 8px;
  overflow: hidden;
}

.bar-fill {
  border-radius: inherit;
  display: block;
  height: 100%;
  min-width: 3px;
}

.grade-fill {
  background: #4c8a61;
}

.class-fill {
  background: #5d7f92;
}

.data-note {
  color: #718078;
  font-size: 0.75rem;
  line-height: 1.5;
  margin: 16px 0 0;
}

@media (max-width: 760px) {
  .metrics,
  .distributions {
    grid-template-columns: 1fr 1fr;
  }

  .distributions {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .metrics {
    grid-template-columns: 1fr;
  }
}
</style>
