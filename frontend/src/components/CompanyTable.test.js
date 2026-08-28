import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";

import CompanyTable from "./CompanyTable.vue";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
  },
}));

describe("CompanyTable", () => {
  beforeEach(() => {
    axios.get.mockReset();
  });

  it("shows a loading state while company data is pending", async () => {
    let resolveRequest;
    axios.get.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const wrapper = mount(CompanyTable);

    expect(wrapper.text()).toContain("Loading company data…");
    expect(wrapper.find("table").exists()).toBe(false);

    resolveRequest({ data: { data: [] } });
    await flushPromises();
    wrapper.unmount();
  });

  it("renders company records returned by the API", async () => {
    axios.get.mockResolvedValue({
      data: {
        data: [
          { id: 1, name: "Evergreen Manufacturing" },
          { id: 2, name: "Harbor Financial" },
        ],
      },
    });

    const wrapper = mount(CompanyTable);
    await flushPromises();

    expect(axios.get).toHaveBeenCalledOnce();
    expect(axios.get).toHaveBeenCalledWith(
      "http://localhost:3000/api/companies",
      expect.objectContaining({
        timeout: 8_000,
        headers: expect.objectContaining({
          Accept: "application/json",
          "X-Request-Id": expect.stringMatching(/^[A-Za-z0-9._:-]+$/),
        }),
      }),
    );
    expect(wrapper.findAll("tbody tr")).toHaveLength(2);
    expect(wrapper.text()).toContain("2 records");
    expect(wrapper.text()).toContain("Evergreen Manufacturing");
    expect(wrapper.text()).toContain("Harbor Financial");
  });

  it("shows an empty state when the API returns no companies", async () => {
    axios.get.mockResolvedValue({ data: { data: [] } });

    const wrapper = mount(CompanyTable);
    await flushPromises();

    expect(wrapper.text()).toContain("No company records are available.");
    expect(wrapper.find("table").exists()).toBe(false);
  });

  it("shows an accessible error when the API request fails", async () => {
    axios.get.mockRejectedValue(new Error("database unavailable"));

    const wrapper = mount(CompanyTable);
    await flushPromises();

    const alert = wrapper.get('[role="alert"]');
    expect(alert.text()).toContain("Company data is temporarily unavailable.");
    expect(wrapper.find("table").exists()).toBe(false);
  });

  it("shows a request reference and retries a failed request", async () => {
    axios.get
      .mockRejectedValueOnce({
        response: { headers: { "x-request-id": "company-trace-123" } },
      })
      .mockResolvedValueOnce({
        data: { data: [{ id: 1, name: "Recovered Company" }] },
      });

    const wrapper = mount(CompanyTable);
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain(
      "Reference: company-trace-123",
    );
    await wrapper.get("button").trigger("click");
    await flushPromises();

    expect(axios.get).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("Recovered Company");
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it("rejects an incompatible API response", async () => {
    axios.get.mockResolvedValue({ data: { data: null } });

    const wrapper = mount(CompanyTable);
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain(
      "Company data is temporarily unavailable.",
    );
  });
});
