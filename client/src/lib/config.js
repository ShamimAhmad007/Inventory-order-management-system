const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

if (import.meta.env.PROD && !configuredApiUrl) {
  throw new Error(
    "VITE_API_URL is not configured. Set it in the frontend hosting settings.",
  );
}

export const API_URL = (
  configuredApiUrl || "http://localhost:5000"
).replace(/\/+$/, "");
