const http = require("http");

const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000;
const SHUTDOWN_SIGNALS = ["SIGTERM", "SIGINT"];

function normalizePort(value) {
  const port = Number.parseInt(value, 10);

  if (Number.isNaN(port)) {
    return value;
  }

  return port >= 0 ? port : false;
}

function describeBinding(address, fallbackPort) {
  if (typeof address === "string") {
    return `pipe ${address}`;
  }

  if (address && typeof address.port === "number") {
    return `port ${address.port}`;
  }

  return typeof fallbackPort === "string"
    ? `pipe ${fallbackPort}`
    : `port ${fallbackPort}`;
}

function defaultLifecycleLogger(entry) {
  console.info(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      ...entry,
    }),
  );
}

function startServer({
  app,
  port,
  createHttpServer = http.createServer,
  processRef = process,
  logEvent = defaultLifecycleLogger,
  shutdownTimeoutMs = DEFAULT_SHUTDOWN_TIMEOUT_MS,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  exit = (code) => processRef.exit(code),
} = {}) {
  if (typeof app !== "function") {
    throw new TypeError("A request-handler function is required");
  }

  if (port === false || port === undefined || port === null) {
    throw new TypeError("A valid port or named pipe is required");
  }

  const server = createHttpServer(app);
  let shuttingDown = false;
  let shutdownFinished = false;
  let shutdownTimer;

  function removeSignalHandlers() {
    for (const signal of SHUTDOWN_SIGNALS) {
      processRef.removeListener(signal, signalHandlers[signal]);
    }
  }

  function finishShutdown({ code, event, level = "info", signal, error }) {
    if (shutdownFinished) {
      return;
    }

    shutdownFinished = true;
    if (shutdownTimer) {
      clearTimer(shutdownTimer);
    }
    removeSignalHandlers();

    logEvent({
      event,
      level,
      signal,
      ...(error ? { message: error.message } : {}),
    });
    exit(code);
  }

  function shutdown(signal) {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logEvent({
      event: "server_shutdown_started",
      level: "info",
      signal,
      timeoutMs: shutdownTimeoutMs,
    });

    shutdownTimer = setTimer(() => {
      server.closeAllConnections?.();
      finishShutdown({
        code: 1,
        event: "server_shutdown_forced",
        level: "error",
        signal,
        error: new Error(`Shutdown exceeded ${shutdownTimeoutMs} ms`),
      });
    }, shutdownTimeoutMs);
    shutdownTimer.unref?.();

    try {
      server.close((error) => {
        if (error) {
          finishShutdown({
            code: 1,
            event: "server_shutdown_failed",
            level: "error",
            signal,
            error,
          });
          return;
        }

        finishShutdown({
          code: 0,
          event: "server_shutdown_completed",
          signal,
        });
      });
      server.closeIdleConnections?.();
    } catch (error) {
      finishShutdown({
        code: 1,
        event: "server_shutdown_failed",
        level: "error",
        signal,
        error,
      });
    }
  }

  const signalHandlers = Object.fromEntries(
    SHUTDOWN_SIGNALS.map((signal) => [signal, () => shutdown(signal)]),
  );

  for (const signal of SHUTDOWN_SIGNALS) {
    processRef.once(signal, signalHandlers[signal]);
  }

  server.on("error", (error) => {
    const binding = describeBinding(null, port);
    const messages = {
      EACCES: `${binding} requires elevated privileges`,
      EADDRINUSE: `${binding} is already in use`,
    };

    logEvent({
      event: "server_start_failed",
      level: "error",
      code: error.code || "SERVER_ERROR",
      binding,
      message: messages[error.code] || error.message,
    });
    removeSignalHandlers();
    exit(1);
  });

  server.on("listening", () => {
    logEvent({
      event: "server_listening",
      level: "info",
      binding: describeBinding(server.address(), port),
    });
  });

  server.listen(port);

  return { server, shutdown };
}

module.exports = {
  DEFAULT_SHUTDOWN_TIMEOUT_MS,
  defaultLifecycleLogger,
  describeBinding,
  normalizePort,
  startServer,
};
