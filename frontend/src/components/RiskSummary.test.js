import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";

import RiskSummary from "./RiskSummary.vue";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
  },
}));

const summary = {
  eventCount: 188,
  companyCount: 33,
  majorClassCount: 3,
  subcategoryCount: 11,
  numericGradeCount: 7,
  specialGradeEventCount: 26,
  gradeDistribution: [
    { grade: "3", count: 9 },
    { grade: "D", count: 26 },
  ],
  classDistribution: [
    { majorClass: "公司治理問題", count: 120 },
    { majorClass: "營運風險上升", count: 38 },
  ],
};

describe("RiskSummary", () => {
  beforeEach(() => {
    axios.get.mockReset();
  });

  it("shows a loading state while analytics are pending", async () => {
    let resolveRequest;
    axios.get.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const wrapper = mount(RiskSummary);

    expect(wrapper.text()).toContain("Loading risk analytics…");
    expect(wrapper.find(".metrics").exists()).toBe(false);

    resolveRequest({ data: { data: { ...summary, eventCount: 0 } } });
    await flushPromises();
    wrapper.unmount();
  });

  it("renders verified metrics and distributions", async () => {
    axios.get.mockResolvedValue({ data: { data: summary } });

    const wrapper = mount(RiskSummary);
    await flushPromises();

    expect(axios.get).toHaveBeenCalledWith(
      "http://localhost:3000/api/risk-summary",
      expect.objectContaining({
        timeout: 8_000,
        headers: expect.objectContaining({
          "X-Request-Id": expect.stringMatching(/^[A-Za-z0-9._:-]+$/),
        }),
      }),
    );
    expect(wrapper.text()).toContain("188");
    expect(wrapper.text()).toContain("33");
    expect(wrapper.text()).toContain("公司治理問題");
    expect(wrapper.text()).toContain("26 records");
    expect(wrapper.findAll('[aria-label="CCRI grade distribution"] li')).toHaveLength(2);
  });

  it("shows an empty state when no events are available", async () => {
    axios.get.mockResolvedValue({
      data: {
        data: {
          ...summary,
          eventCount: 0,
          companyCount: 0,
          gradeDistribution: [],
          classDistribution: [],
        },
      },
    });

    const wrapper = mount(RiskSummary);
    await flushPromises();

    expect(wrapper.text()).toContain("No risk events are available.");
    expect(wrapper.find(".metrics").exists()).toBe(false);
  });

  it("shows an accessible error when the request fails", async () => {
    axios.get.mockRejectedValue(new Error("network unavailable"));

    const wrapper = mount(RiskSummary);
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain(
      "Risk analytics are temporarily unavailable.",
    );
  });

  it("shows a request reference and retries analytics loading", async () => {
    axios.get
      .mockRejectedValueOnce({
        response: { headers: { "x-request-id": "summary-trace-123" } },
      })
      .mockResolvedValueOnce({ data: { data: summary } });

    const wrapper = mount(RiskSummary);
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain(
      "Reference: summary-trace-123",
    );
    await wrapper.get("button").trigger("click");
    await flushPromises();

    expect(axios.get).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("188");
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it("rejects an incompatible API response", async () => {
    axios.get.mockResolvedValue({ data: { data: { eventCount: "188" } } });

    const wrapper = mount(RiskSummary);
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain(
      "Risk analytics are temporarily unavailable.",
    );
  });
});
