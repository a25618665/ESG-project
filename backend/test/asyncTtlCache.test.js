const assert = require("node:assert/strict");

const { createAsyncTtlCache } = require("../src/cache/asyncTtlCache");

describe("asynchronous TTL cache", () => {
  it("reuses a value until its TTL expires", async () => {
    let currentTime = 1_000;
    let loadCalls = 0;
    const cache = createAsyncTtlCache({
      ttlMs: 100,
      now: () => currentTime,
    });
    const loader = async () => {
      loadCalls += 1;
      return `value-${loadCalls}`;
    };

    assert.equal(await cache.get(loader), "value-1");
    currentTime = 1_099;
    assert.equal(await cache.get(loader), "value-1");
    currentTime = 1_100;
    assert.equal(await cache.get(loader), "value-2");
    assert.equal(loadCalls, 2);
  });

  it("coalesces simultaneous cache misses into one load", async () => {
    let resolveLoad;
    let loadCalls = 0;
    const cache = createAsyncTtlCache();
    const loader = () => {
      loadCalls += 1;
      return new Promise((resolve) => {
        resolveLoad = resolve;
      });
    };

    const first = cache.get(loader);
    const second = cache.get(loader);
    await new Promise(setImmediate);
    resolveLoad("shared-value");

    assert.deepEqual(await Promise.all([first, second]), [
      "shared-value",
      "shared-value",
    ]);
    assert.equal(loadCalls, 1);
  });

  it("does not retain failed loads", async () => {
    let loadCalls = 0;
    const cache = createAsyncTtlCache();
    const loader = async () => {
      loadCalls += 1;
      if (loadCalls === 1) throw new Error("temporary failure");
      return "recovered";
    };

    await assert.rejects(cache.get(loader), /temporary failure/);
    assert.equal(await cache.get(loader), "recovered");
    assert.equal(loadCalls, 2);
  });

  it("validates configuration and loader contracts", async () => {
    assert.throws(() => createAsyncTtlCache({ ttlMs: 0 }), /positive/);
    assert.throws(() => createAsyncTtlCache({ now: "invalid" }), /function/);
    await assert.rejects(createAsyncTtlCache().get(null), /loader/);
  });
});
