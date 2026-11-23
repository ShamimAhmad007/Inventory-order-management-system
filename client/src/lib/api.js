import { API_URL } from "./config.js";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function request(
  path,
  { token, method = "GET", body, headers = {} } = {},
) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError(
      "Cannot reach the API. Check that the server is running.",
      0,
    );
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token) {
      window.dispatchEvent(new Event("iom:unauthorized"));
    }
    throw new ApiError(
      payload.message || `Request failed (${response.status})`,
      response.status,
    );
  }
  return payload;
}

export function queryString(values) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== "" && value !== undefined && value !== null) {
      search.set(key, String(value));
    }
  }
  return search.toString();
}
