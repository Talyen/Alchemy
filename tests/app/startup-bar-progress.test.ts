import { expect, it } from "vitest";
import { advanceStartupLoad, createStartupLoadState, type StartupLoadEvent } from "@/app/startup-load-state";
import { STARTUP_BAR_INCOMPLETE_CAP } from "@/lib/game-constants";

it("keeps the game hidden until image decode, fonts, bootstrap and minimum display time settle", () => {
  const gates: StartupLoadEvent[] = [
    { type: "images-settled" },
    { type: "fonts-settled" },
    { type: "bootstrap-ready", ready: true },
    { type: "minimum-elapsed" },
  ];
  for (const missing of gates) {
    let state = createStartupLoadState(10, false);
    state = advanceStartupLoad(state, { type: "image-progress", loaded: 10, total: 10 });
    for (const gate of gates) if (gate !== missing) state = advanceStartupLoad(state, gate);
    for (let timestamp = 0; timestamp <= 5000; timestamp += 50)
      state = advanceStartupLoad(state, { type: "frame", timestamp });
    expect(state.ready, missing.type).toBe(false);
    if (missing.type !== "minimum-elapsed") expect(state.display).toBeLessThanOrEqual(STARTUP_BAR_INCOMPLETE_CAP);
    state = advanceStartupLoad(state, missing);
    for (let timestamp = 5050; timestamp <= 10000; timestamp += 50)
      state = advanceStartupLoad(state, { type: "frame", timestamp });
    expect(state.ready, missing.type).toBe(true);
    expect(advanceStartupLoad(state, { type: "bootstrap-ready", ready: false })).toBe(state);
  }
});

it("handles no artwork, falling targets and a delayed frame without reversing or skipping the loading animation", () => {
  let state = createStartupLoadState(0, true);
  state = advanceStartupLoad(state, { type: "fonts-settled" });
  state = advanceStartupLoad(state, { type: "frame", timestamp: 0 });
  state = advanceStartupLoad(state, { type: "frame", timestamp: 16 });
  expect(state.display).toBeGreaterThan(0);
  expect(state.display).toBeLessThan(0.5);
  state = advanceStartupLoad(state, { type: "bootstrap-ready", ready: false });
  const before = state.display;
  state = advanceStartupLoad(state, { type: "frame", timestamp: 60_000 });
  expect(state.display).toBeGreaterThanOrEqual(before);
  expect(state.display).toBeLessThanOrEqual(STARTUP_BAR_INCOMPLETE_CAP);
  expect(state.ready).toBe(false);
  state = advanceStartupLoad(state, { type: "bootstrap-ready", ready: true });
  for (let timestamp = 60_050; timestamp <= 65_000; timestamp += 50)
    state = advanceStartupLoad(state, { type: "frame", timestamp });
  expect(state.ready).toBe(false);
  expect(state.display).toBeGreaterThan(STARTUP_BAR_INCOMPLETE_CAP);
  const filledDisplay = state.display;
  state = advanceStartupLoad(state, { type: "bootstrap-ready", ready: false });
  state = advanceStartupLoad(state, { type: "frame", timestamp: 70_000 });
  expect(state.display).toBe(filledDisplay);
  expect(state.ready).toBe(false);
  state = advanceStartupLoad(state, { type: "bootstrap-ready", ready: true });
  state = advanceStartupLoad(state, { type: "minimum-elapsed" });
  state = advanceStartupLoad(state, { type: "frame", timestamp: 70_050 });
  expect(state.ready).toBe(true);
});
