import { beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";

import {
  REQUEST_ID_PATTERN,
  REQUEST_TIMEOUT_MS,
  extractRequestId,
  generateRequestId,
  getApi,
  isCanceledRequest,
} from "./client";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    isCancel: vi.fn(),
  },
}));

describe("API client", () => {
  beforeEach(() => {
    axios.get.mockReset();
    axios.isCancel.mockReset();
  });

  it("adds a timeout, JSON accept header, and request correlation", async () => {
    axios.get.mockResolvedValue({ data: { ok: true } });

    await getApi("/health", {
      requestId: "web-test-123",
      params: { verbose: "true" },
    });

    expect(axios.get).toHaveBeenCalledWith("http://localhost:3000/health", {
      timeout: REQUEST_TIMEOUT_MS,
      params: { verbose: "true" },
      headers: {
        Accept: "application/json",
        "X-Request-Id": "web-test-123",
      },
    });
  });

  it("generates valid UUID and fallback request identifiers", () => {
    expect(
      generateRequestId({ randomUUID: () => "browser-generated-id" }),
    ).toBe("browser-generated-id");
    expect(generateRequestId({})).toMatch(REQUEST_ID_PATTERN);
  });

  it("rejects invalid API paths and request identifiers", () => {
    expect(() => getApi("health")).toThrow(/must begin with/);
    expect(() => getApi("/health", { requestId: "invalid id" })).toThrow(
      /valid correlation identifier/,
    );
  });

  it("extracts only safe request identifiers from Axios errors", () => {
    expect(
      extractRequestId({
        response: { headers: { "x-request-id": "trace.api-123" } },
      }),
    ).toBe("trace.api-123");
    expect(
      extractRequestId({
        response: { headers: { "x-request-id": "unsafe identifier" } },
      }),
    ).toBe("");
  });

  it("recognizes canceled Axios requests", () => {
    expect(isCanceledRequest({ code: "ERR_CANCELED" })).toBe(true);
    expect(isCanceledRequest({ name: "CanceledError" })).toBe(true);
    axios.isCancel.mockReturnValue(true);
    expect(isCanceledRequest(new Error("legacy cancellation"))).toBe(true);
  });
});
