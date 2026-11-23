const configuredOrigins = (process.env.CLIENT_URL ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = [
  ...new Set([
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    ...configuredOrigins,
  ]),
];

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    const error = new Error("Origin is not allowed by CORS");
    error.status = 403;
    return callback(error);
  },
};

export default corsOptions;