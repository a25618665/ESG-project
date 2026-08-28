const { randomUUID } = require("crypto");

const REQUEST_ID_HEADER = "X-Request-Id";
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function defaultRequestLogger(entry) {
  console.info(JSON.stringify(entry));
}

function chooseRequestId(headerValue, generateRequestId) {
  if (
    typeof headerValue === "string" &&
    REQUEST_ID_PATTERN.test(headerValue)
  ) {
    return headerValue;
  }

  const generatedValue = generateRequestId();
  if (
    typeof generatedValue !== "string" ||
    !REQUEST_ID_PATTERN.test(generatedValue)
  ) {
    throw new TypeError("The request ID generator returned an invalid value");
  }

  return generatedValue;
}

function createRequestContext(options = {}) {
  const generateRequestId = options.generateRequestId || randomUUID;
  const logRequest =
    options.logRequest === undefined ? defaultRequestLogger : options.logRequest;

  if (typeof generateRequestId !== "function") {
    throw new TypeError("generateRequestId must be a function");
  }
  if (logRequest !== null && typeof logRequest !== "function") {
    throw new TypeError("logRequest must be a function or null");
  }

  return function requestContext(req, res, next) {
    const requestId = chooseRequestId(
      req.get(REQUEST_ID_HEADER),
      generateRequestId
    );
    const method = req.method;
    const path = req.path;
    const startedAt = process.hrtime.bigint();

    req.requestId = requestId;
    res.set(REQUEST_ID_HEADER, requestId);

    res.once("finish", () => {
      if (!logRequest) return;

      const elapsedNanoseconds = process.hrtime.bigint() - startedAt;
      const durationMs = Number(elapsedNanoseconds) / 1_000_000;
      const statusCode = res.statusCode;

      logRequest({
        timestamp: new Date().toISOString(),
        level: statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info",
        event: "http_request",
        requestId,
        method,
        path,
        statusCode,
        durationMs: Number(durationMs.toFixed(2)),
        ...(res.locals.errorCode ? { errorCode: res.locals.errorCode } : {}),
      });
    });

    next();
  };
}

module.exports = {
  REQUEST_ID_HEADER,
  REQUEST_ID_PATTERN,
  chooseRequestId,
  createRequestContext,
  defaultRequestLogger,
};
