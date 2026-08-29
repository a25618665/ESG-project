const { DEFAULT_TTL_MS } = require("../cache/asyncTtlCache");

const DATA_CACHE_MAX_AGE_SECONDS = DEFAULT_TTL_MS / 1_000;
const DATA_CACHE_CONTROL =
  `public, max-age=${DATA_CACHE_MAX_AGE_SECONDS}, stale-while-revalidate=60`;
const NO_STORE_CACHE_CONTROL = "no-store";

function cachePublicData(req, res, next) {
  res.set("Cache-Control", DATA_CACHE_CONTROL);
  next();
}

function preventCaching(req, res, next) {
  res.set("Cache-Control", NO_STORE_CACHE_CONTROL);
  next();
}

module.exports = {
  DATA_CACHE_CONTROL,
  DATA_CACHE_MAX_AGE_SECONDS,
  NO_STORE_CACHE_CONTROL,
  cachePublicData,
  preventCaching,
};
