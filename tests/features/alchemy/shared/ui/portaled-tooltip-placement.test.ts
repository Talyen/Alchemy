import { describe, expect, it } from "vitest";

import {
  buildPortaledTooltipStyle,
  buildSideTooltipStyle,
  measurePortaledTooltipPlacement,
} from "@/features/alchemy/shared/ui/portaled-tooltip-placement";

const stage = { top: 0, left: 0, right: 1280, bottom: 720 };
const midTrigger = { left: 590, right: 690 };
const shortTooltip = { width: 200, height: 100 };
const tallTooltip = { width: 200, height: 400 };

describe("measurePortaledTooltipPlacement", () => {
  it("clamps horizontal position to stage bounds", () => {
    const anchor = { centerX: 640, top: 250, bottom: 330 };
    const { placeBelow, tooltipSide, style } = measurePortaledTooltipPlacement(anchor, midTrigger, shortTooltip, stage);

    expect(placeBelow).toBe(false);
    expect(tooltipSide).toBeNull();
    expect(style.left).toBe("clamp(152px, 640px, 1128px)");
    expect(style.top).toBe(`${anchor.top - shortTooltip.height - 8}px`);
    expect(style.bottom).toBeUndefined();
  });

  it("places below when the measured tooltip clips the stage top", () => {
    const anchor = { centerX: 640, top: 40, bottom: 120 };
    const { placeBelow, tooltipSide, style } = measurePortaledTooltipPlacement(anchor, midTrigger, shortTooltip, stage);

    expect(placeBelow).toBe(true);
    expect(tooltipSide).toBeNull();
    expect(style.top).toBe(`${anchor.bottom + 8}px`);
    expect(style.bottom).toBe("auto");
  });

  it("places beside a mid-stage trigger when neither vertical gutter fits", () => {
    const anchor = { centerX: 640, top: 200, bottom: 520 };
    const { placeBelow, tooltipSide, style } = measurePortaledTooltipPlacement(anchor, midTrigger, tallTooltip, stage);

    expect(placeBelow).toBe(false);
    expect(tooltipSide).toBe("side-end");
    expect(style.left).toBe("698px");
    expect(style.top).toBe("360px");
  });

  it("prefers the roomier side when neither vertical gutter fits", () => {
    const trigger = { left: 80, right: 180 };
    const anchor = { centerX: 130, top: 200, bottom: 520 };
    const { tooltipSide, style } = measurePortaledTooltipPlacement(anchor, trigger, tallTooltip, stage);

    expect(tooltipSide).toBe("side-end");
    expect(style.left).toBe("188px");
  });

  it("places side-start when overflowed near the right edge", () => {
    const trigger = { left: 1100, right: 1200 };
    const anchor = { centerX: 1150, top: 200, bottom: 520 };
    const { placeBelow, tooltipSide, style } = measurePortaledTooltipPlacement(anchor, trigger, tallTooltip, stage);

    expect(placeBelow).toBe(false);
    expect(tooltipSide).toBe("side-start");
    expect(style.left).toBe("892px");
  });
});

describe("buildPortaledTooltipStyle", () => {
  it("uses stage left/right for horizontal clamp instead of viewport width", () => {
    const anchor = { centerX: 200, top: 300, bottom: 380 };
    const narrowStage = { left: 100, right: 900, top: 0, bottom: 720 };
    const style = buildPortaledTooltipStyle(anchor, false, 8, narrowStage);

    expect(style.left).toBe("clamp(252px, 200px, 748px)");
  });
});

describe("buildSideTooltipStyle", () => {
  const anchor = { centerX: 300, top: 200, bottom: 280 };
  const triggerRect = { left: 250, right: 350 };
  const tooltipRect = { width: 200, height: 120 };
  const stage = { top: 0, left: 0, right: 1280, bottom: 720 };

  it("places side-end to the right of the trigger", () => {
    const { side, style } = buildSideTooltipStyle(anchor, triggerRect, tooltipRect, "side-end", stage);

    expect(side).toBe("side-end");
    expect(style.left).toBe("358px");
  });

  it("places side-start to the left of the trigger", () => {
    const { side, style } = buildSideTooltipStyle(anchor, triggerRect, tooltipRect, "side-start", stage);

    expect(side).toBe("side-start");
    expect(style.left).toBe("42px");
  });

  it("flips side-end to side-start when clipped on the right", () => {
    const nearEdgeTrigger = { left: 1100, right: 1200 };
    const { side, style } = buildSideTooltipStyle(anchor, nearEdgeTrigger, tooltipRect, "side-end", stage);

    expect(side).toBe("side-start");
    expect(style.left).toBe("892px");
  });

  it("clamps vertical center inside the stage", () => {
    const topAnchor = { centerX: 300, top: 4, bottom: 40 };
    const { style } = buildSideTooltipStyle(topAnchor, triggerRect, tooltipRect, "side-end", stage);

    expect(style.top).toBe("68px");
  });
});
