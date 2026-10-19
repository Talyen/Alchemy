import { afterEach, describe, expect, it, vi } from "vitest";

import { playHandSlotReflows } from "@/features/alchemy/run-loop/screens/battle-screen/hand-slot-reflow";

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

describe("playHandSlotReflows", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([0.75, 1, 1.5])("continues an interrupted reflow at stage scale %s", (scale) => {
    const { artwork, invertedPoses } = mountSlot(scale, 12);
    artwork.style.transition = "transform 320ms var(--ease-out-expo)";
    // The previous transition targets rest but is still visibly 12 local pixels away.
    artwork.style.transform = "";
    playHandSlotReflows([{ artwork, deltaX: 24 * scale }], 320);

    expect(invertedPoses).toEqual(["translate3d(36px, 0, 0)"]);
    expect(artwork.style.transform).toBe("");
    expect(artwork.style.transition).toBe("transform 320ms var(--ease-out-expo)");
  });

  it("keeps moving when successive layout changes cancel but artwork has not settled", () => {
    const { artwork, invertedPoses } = mountSlot(1, -18);
    playHandSlotReflows([{ artwork, deltaX: 0 }], 320);
    expect(invertedPoses).toEqual(["translate3d(-18px, 0, 0)"]);
    expect(artwork.style.transform).toBe("");
  });

  it("commits consecutive moves without waiting for animation frames", () => {
    const requestFrame = vi.spyOn(window, "requestAnimationFrame");
    const { artwork, invertedPoses } = mountSlot(1, 0);
    playHandSlotReflows([{ artwork, deltaX: 24 }], 320);
    playHandSlotReflows([{ artwork, deltaX: -10 }], 320);
    expect(invertedPoses).toEqual(["translate3d(24px, 0, 0)", "translate3d(-10px, 0, 0)"]);
    expect(requestFrame).not.toHaveBeenCalled();
  });

  it.each([0.75, 1, 1.5])("stops a cancelled unfinished reflow at stage scale %s", (scale) => {
    const { artwork, invertedPoses } = mountSlot(scale, 20);
    artwork.style.transition = "transform 320ms var(--ease-out-expo)";
    artwork.style.transform = "";

    playHandSlotReflows([{ artwork, deltaX: -19.8 * scale }], 320);

    expect(artwork.style.transition).toBe("none");
    expect(artwork.style.transform).toBe("");
    expect(invertedPoses).toEqual([]);
  });

  it("preserves every interrupted sibling pose before committing a shared inversion", () => {
    const first = mountSlot(0.75, 12);
    const second = mountSlot(1.5, -8);
    const committedPoses: string[][] = [];
    first.artwork.style.transition = second.artwork.style.transition = "transform 320ms var(--ease-out-expo)";
    vi.mocked(second.artwork.getBoundingClientRect).mockImplementation(() => {
      // A read must still see the old transition on every sibling.
      expect(first.artwork.style.transition).toBe("transform 320ms var(--ease-out-expo)");
      expect(first.artwork.style.transform).toBe("");
      return rect(200 - 8 * 1.5, 150);
    });
    vi.mocked(first.artwork.getBoundingClientRect).mockImplementation(() => {
      if (first.artwork.style.transition === "none") {
        committedPoses.push([first.artwork.style.transform, second.artwork.style.transform]);
        expect(second.artwork.style.transition).toBe("none");
      }
      return rect(200 + 12 * 0.75, 75);
    });
    playHandSlotReflows(
      [
        { artwork: first.artwork, deltaX: 24 * 0.75 },
        { artwork: second.artwork, deltaX: -10 * 1.5 },
      ],
      320,
    );
    expect(committedPoses).toEqual([["translate3d(36px, 0, 0)", "translate3d(-18px, 0, 0)"]]);
    for (const { artwork } of [first, second]) {
      expect(artwork.style.transform).toBe("");
      expect(artwork.style.transition).toBe("transform 320ms var(--ease-out-expo)");
    }
  });
});
