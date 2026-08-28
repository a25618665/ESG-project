<template>
  <main class="app-shell">
    <header class="hero">
      <p class="hero-eyebrow">Environmental · Social · Governance</p>
      <h1>ESG Analytics Platform</h1>
      <p class="hero-copy">
        A three-tier interface for exploring structured company and risk data.
      </p>
    </header>
    <RiskSummary />
    <RiskEventExplorer />
    <CompanyTable />
  </main>
</template>

<script>
import CompanyTable from "./components/CompanyTable.vue";
import RiskEventExplorer from "./components/RiskEventExplorer.vue";
import RiskSummary from "./components/RiskSummary.vue";

export default {
  name: "App",
  components: {
    CompanyTable,
    RiskEventExplorer,
    RiskSummary,
  },
};
</script>

<style>
* {
  box-sizing: border-box;
}

body {
  background: #f2f7f3;
  margin: 0;
}

#app {
  color: #24372d;
  font-family: Inter, "Segoe UI", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.app-shell {
  margin: 0 auto;
  max-width: 1040px;
  padding: 72px 28px;
}

.hero {
  margin-bottom: 32px;
  max-width: 720px;
}

.hero-eyebrow {
  color: #3f7954;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.13em;
  margin: 0 0 12px;
  text-transform: uppercase;
}

h1 {
  color: #153a27;
  font-size: clamp(2.25rem, 6vw, 4.25rem);
  letter-spacing: -0.045em;
  line-height: 1;
  margin: 0;
}

.hero-copy {
  color: #52665b;
  font-size: 1.1rem;
  line-height: 1.6;
  margin: 20px 0 0;
}

.app-shell > section + section {
  margin-top: 24px;
}
</style>
