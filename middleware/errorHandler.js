class AppError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

const notFound = (req, res, next) => {
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  let status = 500;
  let message = 'Internal server error';
  let details;

  if (err instanceof AppError) {
    status = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON in request body';
  } else if (err.expose && err.status >= 400 && err.status < 500) {
    // Other body-parser errors (e.g. payload too large, bad encoding)
    status = 400;
    message = err.message;
  } else if (err.name === 'ValidationError' && err.errors) {
    status = 400;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => e.message);
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid value for ${err.path}`;
  } else if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'field';
    status = 409;
    message = `Duplicate value: a product with this ${field} already exists`;
  } else {
    console.error(err);
  }

  const body = { error: { status, message } };
  if (details && details.length) {
    body.error.details = details;
  }
  res.status(status).json(body);
};

module.exports = { AppError, notFound, errorHandler };
