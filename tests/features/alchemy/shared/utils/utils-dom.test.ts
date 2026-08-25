// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearTiltFromEvent, getCardRect, setTiltFromEvent } from "@/features/alchemy/shared/utils/dom";
import { installRafStub } from "../../../../helpers/animation-test";

describe("getCardRect", () => {
  it("transforms a DOMRect to a CardRect", () => {
    const rect = {
      x: 10,
      y: 20,
      width: 100,
      height: 150,
      top: 20,
      right: 110,
      bottom: 170,
      left: 10,
      toJSON() {},
    } as DOMRect;
    const cardRect = getCardRect(rect);
    expect(cardRect).toEqual({ x: 10, y: 20, width: 100, height: 150 });
  });
});

describe("tilt geometry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("refreshes the target rectangle for each animation frame", () => {
    const frames = installRafStub();

    const target = document.createElement("div");
    const getBoundingClientRect = vi
      .spyOn(target, "getBoundingClientRect")
      .mockReturnValueOnce(new DOMRect(0, 0, 100, 100))
      .mockReturnValueOnce(new DOMRect(100, 0, 100, 100));

    setTiltFromEvent({ currentTarget: target, clientX: 50, clientY: 50 } as never);
    frames.shift()?.(0);
    expect(target.style.getPropertyValue("--tilt-rotate-y")).toBe("0deg");

    setTiltFromEvent({ currentTarget: target, clientX: 150, clientY: 50 } as never);
    frames.shift()?.(16);
    expect(target.style.getPropertyValue("--tilt-rotate-y")).toBe("0deg");
    expect(getBoundingClientRect).toHaveBeenCalledTimes(2);

    clearTiltFromEvent({ currentTarget: target } as never);
  });
});
