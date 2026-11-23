export function notFound(req, res) {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern ?? {})[0] ?? "value";
    return res
      .status(409)
      .json({ success: false, message: `${field} already exists` });
  }
  if (error.name === "ValidationError") {
    return res.status(400).json({ success: false, message: error.message });
  }
  if (error.name === "CastError") {
    return res.status(400).json({ success: false, message: "Invalid identifier" });
  }
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Invalid JSON body" });
  }

  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) console.error(error);
  return res.status(status).json({
    success: false,
    message: status >= 500 ? "An unexpected server error occurred" : error.message,
  });
}
