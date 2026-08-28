const AppError = require("../errors/AppError");

function notFound(req, res, next) {
  next(
    new AppError(
      `Route not found: ${req.method} ${req.originalUrl}`,
      404,
      "ROUTE_NOT_FOUND"
    )
  );
}

function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || 500;
  const code = error.code || "INTERNAL_ERROR";
  const message =
    statusCode >= 500 && !(error instanceof AppError)
      ? "An unexpected server error occurred"
      : error.message;

  if (req.app.get("env") !== "test" && statusCode >= 500) {
    console.error(error);
  }

  res.locals.errorCode = code;
  res.status(statusCode).json({
    error: { code, message, requestId: req.requestId },
  });
}

module.exports = { errorHandler, notFound };
