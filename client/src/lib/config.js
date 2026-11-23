const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const defaultApiUrl = import.meta.env.PROD
  ? "https://inventory-order-management-system-1i6m.onrender.com"
  : "http://localhost:5000";

export const API_URL = (
  configuredApiUrl || defaultApiUrl
).replace(/\/+$/, "");
