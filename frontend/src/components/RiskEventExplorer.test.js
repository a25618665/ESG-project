import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";

import RiskEventExplorer from "./RiskEventExplorer.vue";

vi.mock("axios", () => ({
  default: { get: vi.fn() },
}));

const event = {
  id: 1,
  sourceRow: 2,
  companyCode: "000063",
  companyName: "中興通訊",
  eventDate: "2017-02-22",
  eventCode: "T0100001",
  ccriGrade: "7",
  dataPeriod: "2016/06",
  majorClass: "公司治理問題",
  subcategory: "董監高管異動(非董監改選)",
};

function response(data = [event], meta = {}) {
  return {
    data: {
      data,
      meta: { total: data.length, count: data.length, limit: 10, offset: 0, ...meta },
    },
  };
}

describe("RiskEventExplorer", () => {
  beforeEach(() => axios.get.mockReset());

  it("loads and renders source-backed risk events", async () => {
    axios.get.mockResolvedValue(response());
    const wrapper = mount(RiskEventExplorer);
    await flushPromises();

    expect(axios.get).toHaveBeenCalledWith(
      "http://localhost:3000/api/risk-events",
      expect.objectContaining({
        params: { limit: 10, offset: 0 },
        signal: expect.any(AbortSignal),
        timeout: 8_000,
        headers: expect.objectContaining({
          "X-Request-Id": expect.stringMatching(/^[A-Za-z0-9._:-]+$/),
        }),
      }),
    );
    expect(wrapper.findAll("tbody tr")).toHaveLength(1);
    expect(wrapper.text()).toContain("中興通訊");
    expect(wrapper.text()).toContain("公司治理問題");
    expect(wrapper.text()).toContain("1 matching events");
  });

  it("submits filters as API query parameters", async () => {
    axios.get.mockResolvedValue(response());
    const wrapper = mount(RiskEventExplorer);
    await flushPromises();

    await wrapper.get("select").setValue("7");
    await wrapper.get('input[placeholder="e.g. 002628"]').setValue("002628");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(axios.get).toHaveBeenLastCalledWith(
      "http://localhost:3000/api/risk-events",
      expect.objectContaining({
        params: { limit: 10, offset: 0, grade: "7", companyCode: "002628" },
      }),
    );
  });

  it("requests the next page without losing active filters", async () => {
    axios.get
      .mockResolvedValueOnce(response([event], { total: 21 }))
      .mockResolvedValueOnce(response([event], { total: 21, offset: 10 }));
    const wrapper = mount(RiskEventExplorer);
    await flushPromises();

    const nextButton = wrapper
      .findAll("button")
      .find((button) => button.text() === "Next");
    await nextButton.trigger("click");
    await flushPromises();

    expect(axios.get).toHaveBeenLastCalledWith(
      "http://localhost:3000/api/risk-events",
      expect.objectContaining({ params: { limit: 10, offset: 10 } }),
    );
  });

  it("shows an empty state", async () => {
    axios.get.mockResolvedValue(response([]));
    const wrapper = mount(RiskEventExplorer);
    await flushPromises();

    expect(wrapper.text()).toContain("No risk events match these filters.");
    expect(wrapper.find("table").exists()).toBe(false);
  });

  it("shows an accessible error for failed requests", async () => {
    axios.get
      .mockResolvedValueOnce(response())
      .mockRejectedValueOnce({
        response: { headers: { "x-request-id": "event-trace-123" } },
      });
    const wrapper = mount(RiskEventExplorer);
    await flushPromises();

    await wrapper.vm.loadEvents();
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain(
      "Risk events are temporarily unavailable.",
    );
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "Reference: event-trace-123",
    );
  });

  it("retries a failed event request", async () => {
    axios.get
      .mockRejectedValueOnce(new Error("unavailable"))
      .mockResolvedValueOnce(response());
    const wrapper = mount(RiskEventExplorer);
    await flushPromises();

    await wrapper.get('[role="alert"] button').trigger("click");
    await flushPromises();

    expect(axios.get).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("中興通訊");
  });

  it("ignores an older response after a newer filter request completes", async () => {
    let resolveInitial;
    let resolveFiltered;
    axios.get
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveInitial = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFiltered = resolve;
        }),
      );
    const wrapper = mount(RiskEventExplorer);

    await wrapper.get("select").setValue("7");
    await wrapper.get("form").trigger("submit");
    resolveFiltered(
      response([{ ...event, id: 2, companyName: "Newest Result" }]),
    );
    await flushPromises();
    resolveInitial(response([{ ...event, companyName: "Stale Result" }]));
    await flushPromises();

    expect(wrapper.text()).toContain("Newest Result");
    expect(wrapper.text()).not.toContain("Stale Result");
  });

  it("rejects incompatible API responses", async () => {
    axios.get.mockResolvedValue({ data: { data: null, meta: {} } });
    const wrapper = mount(RiskEventExplorer);
    await flushPromises();

    expect(wrapper.get('[role="alert"]').exists()).toBe(true);
  });
});
