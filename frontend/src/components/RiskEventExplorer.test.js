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
      { params: { limit: 10, offset: 0 } },
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
      {
        params: { limit: 10, offset: 0, grade: "7", companyCode: "002628" },
      },
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
      { params: { limit: 10, offset: 10 } },
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
      .mockRejectedValueOnce(new Error("unavailable"));
    const wrapper = mount(RiskEventExplorer);
    await flushPromises();

    await wrapper.vm.loadEvents();
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Risk events are temporarily unavailable.",
    );
  });

  it("rejects incompatible API responses", async () => {
    axios.get.mockResolvedValue({ data: { data: null, meta: {} } });
    const wrapper = mount(RiskEventExplorer);
    await flushPromises();

    expect(wrapper.get('[role="alert"]').exists()).toBe(true);
  });
});
