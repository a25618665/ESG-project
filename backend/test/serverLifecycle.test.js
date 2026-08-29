const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");

const {
  describeBinding,
  normalizePort,
  startServer,
} = require("../src/serverLifecycle");

function createHarness(overrides = {}) {
  const server = new EventEmitter();
  const processRef = new EventEmitter();
  const logs = [];
  const exitCodes = [];
  const timers = [];

  server.listenCalls = [];
  server.closeCalls = 0;
  server.closeIdleCalls = 0;
  server.closeAllCalls = 0;
  server.listen = (port) => server.listenCalls.push(port);
  server.address = () => ({ port: 3000 });
  server.close = (callback) => {
    server.closeCalls += 1;
    server.closeCallback = callback;
  };
  server.closeIdleConnections = () => {
    server.closeIdleCalls += 1;
  };
  server.closeAllConnections = () => {
    server.closeAllCalls += 1;
  };

  const result = startServer({
    app: () => {},
    port: 3000,
    createHttpServer: () => server,
    processRef,
    logEvent: (entry) => logs.push(entry),
    setTimer: (callback, delay) => {
      const timer = { callback, delay, unref() {} };
      timers.push(timer);
      return timer;
    },
    clearTimer: (timer) => {
      timer.cleared = true;
    },
    exit: (code) => exitCodes.push(code),
    ...overrides,
  });

  return { exitCodes, logs, processRef, result, server, timers };
}

describe("server lifecycle", () => {
  it("normalizes numeric ports and named pipes", () => {
    assert.equal(normalizePort("3000"), 3000);
    assert.equal(normalizePort(0), 0);
    assert.equal(normalizePort("named-pipe"), "named-pipe");
    assert.equal(normalizePort("-1"), false);
  });

  it("describes TCP and named-pipe bindings", () => {
    assert.equal(describeBinding({ port: 4321 }), "port 4321");
    assert.equal(describeBinding("api-pipe"), "pipe api-pipe");
    assert.equal(describeBinding(null, 3000), "port 3000");
  });

  it("starts the HTTP server and records its listening address", () => {
    const { logs, result, server } = createHarness();

    server.emit("listening");

    assert.equal(result.server, server);
    assert.deepEqual(server.listenCalls, [3000]);
    assert.deepEqual(logs, [
      {
        event: "server_listening",
        level: "info",
        binding: "port 3000",
      },
    ]);
  });

  it("drains connections and exits successfully on SIGTERM", async () => {
    const { exitCodes, logs, processRef, server, timers } = createHarness();

    processRef.emit("SIGTERM");
    server.closeCallback();
    await new Promise(setImmediate);

    assert.equal(server.closeCalls, 1);
    assert.equal(server.closeIdleCalls, 1);
    assert.equal(server.closeAllCalls, 0);
    assert.equal(timers[0].delay, 10_000);
    assert.equal(timers[0].cleared, true);
    assert.deepEqual(exitCodes, [0]);
    assert.deepEqual(
      logs.map(({ event }) => event),
      ["server_shutdown_started", "server_shutdown_completed"],
    );
  });

  it("waits for asynchronous resource cleanup before exiting", async () => {
    let resolveCleanup;
    let cleanupCalls = 0;
    const cleanup = new Promise((resolve) => {
      resolveCleanup = resolve;
    });
    const { exitCodes, logs, processRef, server } = createHarness({
      closeResources: () => {
        cleanupCalls += 1;
        return cleanup;
      },
    });

    processRef.emit("SIGTERM");
    server.closeCallback();
    await new Promise(setImmediate);

    assert.equal(cleanupCalls, 1);
    assert.deepEqual(exitCodes, []);

    resolveCleanup();
    await cleanup;
    await new Promise(setImmediate);

    assert.deepEqual(exitCodes, [0]);
    assert.equal(logs.at(-1).event, "server_shutdown_completed");
  });

  it("reports resource cleanup failures", async () => {
    const { exitCodes, logs, processRef, server } = createHarness({
      closeResources: async () => {
        throw new Error("database pool did not close");
      },
    });

    processRef.emit("SIGTERM");
    server.closeCallback();
    await new Promise(setImmediate);

    assert.deepEqual(exitCodes, [1]);
    assert.deepEqual(logs.at(-1), {
      event: "server_shutdown_failed",
      level: "error",
      signal: "SIGTERM",
      message: "database pool did not close",
    });
  });

  it("requires a resource cleanup function", () => {
    assert.throws(
      () => createHarness({ closeResources: "invalid" }),
      /closeResources must be a function/,
    );
  });

  it("handles repeated shutdown signals only once", () => {
    const { processRef, server } = createHarness();

    processRef.emit("SIGTERM");
    processRef.emit("SIGINT");

    assert.equal(server.closeCalls, 1);
    assert.equal(server.closeIdleCalls, 1);
  });

  it("forces remaining connections closed after the shutdown deadline", () => {
    const { exitCodes, logs, processRef, server, timers } = createHarness({
      shutdownTimeoutMs: 250,
    });

    processRef.emit("SIGTERM");
    timers[0].callback();

    assert.equal(server.closeAllCalls, 1);
    assert.deepEqual(exitCodes, [1]);
    assert.equal(logs.at(-1).event, "server_shutdown_forced");
    assert.match(logs.at(-1).message, /250 ms/);
  });

  it("reports startup failures without throwing implementation details", () => {
    const { exitCodes, logs, server } = createHarness();
    const error = Object.assign(new Error("listen failed"), {
      code: "EADDRINUSE",
    });

    server.emit("error", error);

    assert.deepEqual(exitCodes, [1]);
    assert.deepEqual(logs.at(-1), {
      event: "server_start_failed",
      level: "error",
      code: "EADDRINUSE",
      binding: "port 3000",
      message: "port 3000 is already in use",
    });
  });
});
