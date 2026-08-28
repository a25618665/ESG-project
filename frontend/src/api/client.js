import axios from "axios";

export const REQUEST_TIMEOUT_MS = 8_000;
export const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

const apiBaseUrl = (
  import.meta.env.VITE_API_URL || "http://localhost:3000/"
).replace(/\/+$/, "");

export function generateRequestId(cryptoObject = globalThis.crypto) {
  const generated = cryptoObject?.randomUUID?.();
  if (typeof generated === "string" && REQUEST_ID_PATTERN.test(generated)) {
    return generated;
  }

  return `web-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export function getApi(path, options = {}) {
  if (typeof path !== "string" || !path.startsWith("/")) {
    throw new TypeError("API paths must begin with /");
  }

  const {
    headers = {},
    requestId = generateRequestId(),
    ...requestOptions
  } = options;
  if (!REQUEST_ID_PATTERN.test(requestId)) {
    throw new TypeError("requestId must be a valid correlation identifier");
  }

  return axios.get(`${apiBaseUrl}${path}`, {
    timeout: REQUEST_TIMEOUT_MS,
    ...requestOptions,
    headers: {
      Accept: "application/json",
      ...headers,
      "X-Request-Id": requestId,
    },
  });
}

export function extractRequestId(error) {
  const headers = error?.response?.headers;
  const value =
    (typeof headers?.get === "function" && headers.get("x-request-id")) ||
    headers?.["x-request-id"] ||
    headers?.["X-Request-Id"];

  return typeof value === "string" && REQUEST_ID_PATTERN.test(value)
    ? value
    : "";
}

export function isCanceledRequest(error) {
  return (
    error?.code === "ERR_CANCELED" ||
    error?.name === "CanceledError" ||
    axios.isCancel?.(error) === true
  );
}
