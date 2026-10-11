import { afterEach, describe, expect, it, vi } from "vitest";

import { playHandSlotReflow } from "@/features/alchemy/run-loop/screens/battle-screen/hand-slot-reflow";

function rect(centerX: number, width: number): DOMRect {
  return { left: centerX - width / 2, width } as DOMRect;
}

function mountSlot(scale: number, remainingX: number) {
  const slot = document.createElement("div");
  const artwork = document.createElement("div");
  slot.append(artwork);
  Object.defineProperty(slot, "offsetWidth", { value: 100 });
  vi.spyOn(slot, "getBoundingClientRect").mockReturnValue(rect(200, 100 * scale));
  const invertedPoses: string[] = [];
  vi.spyOn(artwork, "getBoundingClientRect").mockImplementation(() => {
    if (artwork.style.transition === "none") invertedPoses.push(artwork.style.transform);
    return rect(200 + remainingX * scale, 100 * scale);
  });
  return { artwork, invertedPoses };
}

describe("playHandSlotReflow", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([0.75, 1, 1.5])("continues an interrupted reflow at stage scale %s", (scale) => {
    const { artwork, invertedPoses } = mountSlot(scale, 12);
    artwork.style.transition = "transform 320ms var(--ease-out-expo)";
    // The previous transition targets rest but is still visibly 12 local pixels away.
    artwork.style.transform = "";
    playHandSlotReflow(artwork, 24 * scale, 320);

    expect(invertedPoses).toEqual(["translate3d(36px, 0, 0)"]);
    expect(artwork.style.transform).toBe("");
    expect(artwork.style.transition).toBe("transform 320ms var(--ease-out-expo)");
  });

  it("keeps moving when successive layout changes cancel but artwork has not settled", () => {
    const { artwork, invertedPoses } = mountSlot(1, -18);
    playHandSlotReflow(artwork, 0, 320);
    expect(invertedPoses).toEqual(["translate3d(-18px, 0, 0)"]);
    expect(artwork.style.transform).toBe("");
  });

  it("commits consecutive moves without waiting for animation frames", () => {
    const requestFrame = vi.spyOn(window, "requestAnimationFrame");
    const { artwork, invertedPoses } = mountSlot(1, 0);
    playHandSlotReflow(artwork, 24, 320);
    playHandSlotReflow(artwork, -10, 320);
    expect(invertedPoses).toEqual(["translate3d(24px, 0, 0)", "translate3d(-10px, 0, 0)"]);
    expect(requestFrame).not.toHaveBeenCalled();
  });
});
