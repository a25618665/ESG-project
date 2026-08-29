const DEFAULT_TTL_MS = 30_000;

function createAsyncTtlCache(options = {}) {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const now = options.now || Date.now;

  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new TypeError("ttlMs must be a positive finite number");
  }
  if (typeof now !== "function") {
    throw new TypeError("now must be a function");
  }

  let cachedValue;
  let expiresAt = 0;
  let hasCachedValue = false;
  let pendingLoad = null;

  return {
    async get(loader) {
      if (typeof loader !== "function") {
        throw new TypeError("loader must be a function");
      }

      if (hasCachedValue && now() < expiresAt) {
        return cachedValue;
      }
      if (pendingLoad) {
        return pendingLoad;
      }

      hasCachedValue = false;
      const load = Promise.resolve().then(loader);
      pendingLoad = load;

      try {
        const value = await load;
        if (pendingLoad === load) {
          cachedValue = value;
          hasCachedValue = true;
          expiresAt = now() + ttlMs;
        }
        return value;
      } finally {
        if (pendingLoad === load) {
          pendingLoad = null;
        }
      }
    },

    clear() {
      cachedValue = undefined;
      expiresAt = 0;
      hasCachedValue = false;
      pendingLoad = null;
    },
  };
}

module.exports = { DEFAULT_TTL_MS, createAsyncTtlCache };
