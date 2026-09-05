import { describe, expect, it } from "vitest";
import { summarizeTrace } from "../../performance/trace-insights";
import type { FrameSampleRaw } from "../../performance/metrics";

const sample: FrameSampleRaw = {
  frameGaps: [
    { startTime: 10, duration: 80 },
    { startTime: 100, duration: 25 },
  ],
  durationMs: 150,
  longTasks: [],
  phaseMarks: [
    { time: 0, phase: "play-card" },
    { time: 30, phase: "damage-feedback" },
  ],
};
const event = (name: string, ts: number, dur: number, extra = {}) => ({
  name,
  ts: 1_000_000 + ts * 1000,
  dur: dur * 1000,
  ph: "X",
  pid: 2,
  tid: 3,
  ...extra,
});
const markers = [
  event("alchemy-perf-window-start", 0, 0, { ph: "I" }),
  event("alchemy-perf-window-end", 150, 0, { ph: "I" }),
];

describe("trace slow-frame evidence", () => {
  it("isolates the marked renderer, clips the gap and removes nested double counting", () => {
    const result = summarizeTrace(
      [
        ...markers,
        event("RunTask", -10, 110),
        event("FunctionCall", 10, 60, { args: { data: { url: "app.js", functionName: "update", lineNumber: 8 } } }),
        event("Layout", 30, 20),
        event("Paint", 70, 30),
        event("RasterTask", 0, 150, { tid: 4 }),
        event("FunctionCall", 0, 150, { pid: 5 }),
        event("Layout", 155, 500),
      ],
      sample,
    );
    expect(result.status).toBe("available");
    const frame = result.slowFrames[0]!;
    expect(frame.phases).toEqual(["play-card", "damage-feedback"]);
    expect(frame.work).toEqual([
      { name: "FunctionCall", category: "scripting", source: "update app.js line 8", selfMs: 40 },
      { name: "Layout", category: "style/layout", source: "", selfMs: 20 },
      { name: "Paint", category: "paint/composite", source: "", selfMs: 20 },
    ]);
    expect(frame.unaccountedMs).toBe(0);
    expect(result.slowFrames[1]?.unaccountedMs).toBe(25);
  });

  it("pairs synchronous begin/end events and accepts Chrome trace containers", () => {
    const result = summarizeTrace(
      {
        traceEvents: [
          ...markers,
          event("FunctionCall", 10, 0, { ph: "B" }),
          event("MinorGC", 20, 0, { ph: "B" }),
          event("", 35, 0, { ph: "E" }),
          event("", 50, 0, { ph: "E" }),
        ],
      },
      sample,
    );
    expect(result.slowFrames[0]?.work.map(({ category, selfMs }) => [category, selfMs])).toEqual([
      ["scripting", 25],
      ["garbage collection", 15],
    ]);
    expect(result.slowFrames[0]?.unaccountedMs).toBe(40);
  });

  it("does not claim attribution when markers or trace format are missing", () => {
    expect(summarizeTrace([], sample).status).toBe("unavailable");
    expect(summarizeTrace(null, sample).status).toBe("unavailable");
    expect(summarizeTrace([markers[0]], sample).status).toBe("unavailable");
  });

  it("keeps sub-hitch drops and bounds output to the worst twenty gaps", () => {
    const result = summarizeTrace(markers, {
      ...sample,
      frameGaps: Array.from({ length: 25 }, (_, i) => ({ startTime: 0, duration: 21 + i })),
    });
    expect(result.slowFrames).toHaveLength(20);
    expect(result.slowFrames[0]?.gapMs).toBe(45);
    expect(result.slowFrames[19]?.gapMs).toBe(26);
  });
});
