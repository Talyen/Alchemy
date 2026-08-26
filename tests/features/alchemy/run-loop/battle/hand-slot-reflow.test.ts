// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { getElementCenterX, playHandSlotReflow } from "@/features/alchemy/run-loop/battle/hand-slot-reflow";

describe("playHandSlotReflow", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("applies invert transform then animates back to rest", () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });

    const slot = document.createElement("div");
    playHandSlotReflow(slot, 24, 320);

    expect(slot.style.transform).toBe("");
    expect(slot.style.transition).toBe("transform 320ms var(--ease-out-expo)");
  });

  it("skips negligible movement", () => {
    const slot = document.createElement("div");
    playHandSlotReflow(slot, 0.2, 320);
    expect(slot.style.transform).toBe("");
  });
});

describe("getElementCenterX", () => {
  it("returns the horizontal center of an element", () => {
    const element = document.createElement("div");
    Object.defineProperty(element, "getBoundingClientRect", {
      value: () => ({
        left: 40,
        width: 100,
        top: 0,
        height: 0,
        right: 140,
        bottom: 0,
        x: 40,
        y: 0,
        toJSON: () => ({}),
      }),
    });

    expect(getElementCenterX(element)).toBe(90);
  });
});
