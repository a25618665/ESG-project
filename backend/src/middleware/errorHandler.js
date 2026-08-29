const AppError = require("../errors/AppError");

const SAFE_PARSER_ERRORS = Object.freeze({
  "entity.parse.failed": {
    statusCode: 400,
    code: "INVALID_REQUEST_BODY",
    message: "The request body is not valid JSON",
  },
  "entity.too.large": {
    statusCode: 413,
    code: "REQUEST_BODY_TOO_LARGE",
    message: "The request body exceeds the allowed size",
  },
  "parameters.too.many": {
    statusCode: 413,
    code: "TOO_MANY_PARAMETERS",
    message: "The request contains too many form parameters",
  },
});

function notFound(req, res, next) {
  next(
    new AppError(
      `Route not found: ${req.method} ${req.path}`,
      404,
      "ROUTE_NOT_FOUND"
    )
  );
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const parserError = SAFE_PARSER_ERRORS[error.type];
  const providedStatus = error.statusCode || error.status;
  const hasSafeStatus =
    Number.isInteger(providedStatus) &&
    providedStatus >= 400 &&
    providedStatus <= 599;
  const statusCode =
    parserError?.statusCode || (hasSafeStatus ? providedStatus : 500);
  const isOperational = error instanceof AppError;
  const code =
    parserError?.code ||
    (isOperational
      ? error.code
      : statusCode >= 500
        ? "INTERNAL_ERROR"
        : "INVALID_REQUEST");
  const message =
    parserError?.message ||
    (isOperational
      ? error.message
      : statusCode >= 500
        ? "An unexpected server error occurred"
        : "The request could not be processed");

  if (req.app.get("env") !== "test" && statusCode >= 500) {
    console.error(error);
  }

  res.locals.errorCode = code;
  res.status(statusCode).json({
    error: { code, message, requestId: req.requestId },
  });
}

module.exports = { errorHandler, notFound };
