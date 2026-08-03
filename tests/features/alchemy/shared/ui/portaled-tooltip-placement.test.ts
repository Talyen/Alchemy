// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import {
  buildPortaledTooltipStyle,
  measurePortaledTooltipPlacement,
  shouldPlacePortaledTooltipBelow,
} from "@/features/alchemy/shared/ui/portaled-tooltip-placement";

const stage = { top: 0, left: 0, right: 1280, bottom: 720 };

describe("shouldPlacePortaledTooltipBelow", () => {
  it("keeps above when there is room within the stage", () => {
    const anchor = { centerX: 640, top: 250, bottom: 330 };
    expect(shouldPlacePortaledTooltipBelow(anchor, 100, stage)).toBe(false);
  });

  it("flips below when the tile is within the old 320px threshold but above still fits in stage", () => {
    const anchor = { centerX: 640, top: 280, bottom: 360 };
    expect(anchor.top < 320).toBe(true);
    expect(shouldPlacePortaledTooltipBelow(anchor, 100, stage)).toBe(false);
  });

  it("flips below when the tooltip would clip the stage top", () => {
    const anchor = { centerX: 640, top: 40, bottom: 120 };
    expect(shouldPlacePortaledTooltipBelow(anchor, 100, stage)).toBe(true);
  });
});

describe("measurePortaledTooltipPlacement", () => {
  it("clamps horizontal position to stage bounds", () => {
    const anchor = { centerX: 640, top: 250, bottom: 330 };
    const { style } = measurePortaledTooltipPlacement(anchor, { top: 142, bottom: 242, height: 100 }, stage);

    expect(style.left).toBe("clamp(152px, 640px, 1128px)");
    expect(style.top).toBe("auto");
    expect(style.bottom).toBe(`${window.innerHeight - anchor.top + 8}px`);
  });

  it("places below when the measured tooltip clips the stage top", () => {
    const anchor = { centerX: 640, top: 40, bottom: 120 };
    const { placeBelow, style } = measurePortaledTooltipPlacement(anchor, { top: 2, bottom: 102, height: 100 }, stage);

    expect(placeBelow).toBe(true);
    expect(style.top).toBe(`${anchor.bottom + 8}px`);
    expect(style.bottom).toBe("auto");
  });
});

describe("buildPortaledTooltipStyle", () => {
  it("uses stage left/right for horizontal clamp instead of viewport width", () => {
    const anchor = { centerX: 200, top: 300, bottom: 380 };
    const narrowStage = { left: 100, right: 900 };
    const style = buildPortaledTooltipStyle(anchor, false, 8, narrowStage);

    expect(style.left).toBe("clamp(252px, 200px, 748px)");
  });
});
