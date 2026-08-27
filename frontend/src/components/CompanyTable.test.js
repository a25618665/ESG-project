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
    expect(alert.text()).toBe("Company data is temporarily unavailable.");
    expect(wrapper.find("table").exists()).toBe(false);
  });

  it("rejects an incompatible API response", async () => {
    axios.get.mockResolvedValue({ data: { data: null } });

    const wrapper = mount(CompanyTable);
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Company data is temporarily unavailable.",
    );
  });
});
