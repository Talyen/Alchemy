import { anchoredPage } from "@/features/alchemy/shared/ui/pagination";
import { describe, expect, it } from "vitest";
import { getVirtualResolutionLayout } from "@/features/alchemy/shared/ui/use-virtual-resolution";
import { CONTENT_REFERENCE_VIEWPORT, STAGE_HEIGHT } from "@/lib/game-constants";
import { normalizeDisplayPercent } from "@/lib/settings-values";
import { getGridCapacity } from "@/features/alchemy/shared/ui/adaptive-grid";

describe("display sizing", () => {
  it("preserves the reference browser content size", () => {
    const { width, height } = CONTENT_REFERENCE_VIEWPORT;
    const layout = getVirtualResolutionLayout("auto", width, height);
    expect(layout.contentScale).toBeCloseTo(height / STAGE_HEIGHT, 12);
    expect(layout.stageContentScale).toBeCloseTo(1, 12);
    expect(layout.tooltipScale).toBeCloseTo(1, 12);
    expect(parseFloat(layout.frameStyle.width)).toBeCloseTo(width);
    expect(parseFloat(layout.frameStyle.height)).toBeCloseTo(height);
  });
  it.each([0.5, 1, 2, 4, 8])("preserves composition proportions at %ix reference size", (factor) => {
    const { width, height } = CONTENT_REFERENCE_VIEWPORT;
    const reference = getVirtualResolutionLayout("auto", width, height);
    const layout = getVirtualResolutionLayout("auto", width * factor, height * factor);
    expect(layout.contentScale / reference.contentScale).toBeCloseTo(factor, 12);
    expect(layout.stageContentScale).toBeCloseTo(reference.stageContentScale, 12);
    expect(layout.tooltipScale / reference.tooltipScale).toBeCloseTo(factor, 12);
  });
  it("adds space instead of enlarging content when only one dimension grows", () => {
    const { width, height } = CONTENT_REFERENCE_VIEWPORT;
    const reference = getVirtualResolutionLayout("auto", width, height);
    for (const [w, h] of [
      [width * 2, height],
      [width, height * 2],
    ]) {
      const layout = getVirtualResolutionLayout("auto", w!, h!);
      expect(layout.contentScale).toBeCloseTo(reference.contentScale, 12);
      expect(parseFloat(layout.frameStyle.width)).toBeCloseTo(w!, 12);
      expect(parseFloat(layout.frameStyle.height)).toBeCloseTo(h!, 12);
    }
  });
  it("scales continuously across 1080 CSS pixels and has no large-window cap", () => {
    const aspect = CONTENT_REFERENCE_VIEWPORT.width / CONTENT_REFERENCE_VIEWPORT.height;
    const reference = getVirtualResolutionLayout("auto", 1080 * aspect, 1080);
    const nearby = getVirtualResolutionLayout("auto", 1080.001 * aspect, 1080.001);
    expect(nearby.contentScale).toBeCloseTo(reference.contentScale, 5);
    const huge = getVirtualResolutionLayout("auto", 4320 * aspect, 4320);
    expect(huge.contentScale).toBe(4);
    expect(huge.stageContentScale).toBe(1);
  });
  it.each([
    [0, 0],
    [0, 720],
    [1280, 0],
    [NaN, Infinity],
  ])("handles unavailable geometry %i x %i", (width, height) => {
    const layout = getVirtualResolutionLayout("auto", width, height);
    expect(Number.isFinite(layout.stageContentScale)).toBe(true);
    expect(Number.isFinite(layout.stageScale)).toBe(true);
  });
  it("fits explicit aspect ratios without stretching or clipping", () => {
    const layout = getVirtualResolutionLayout("16:9", 1280, 800);
    expect(layout.frameStyle.width).toBe("1280px");
    expect(layout.frameStyle.height).toBe("720px");
    expect(getVirtualResolutionLayout("16:9", 100, 60).frameStyle.width).toBe("100px");
    const fourK = getVirtualResolutionLayout("16:9", 3840, 2160);
    expect(fourK.stageStyle.width).toBe("1920px");
    expect(fourK.stageStyle.height).toBe("1080px");
    expect(fourK.stageStyle.transform).toBe("scale(2)");
    expect(fourK.stagePixelRatio).toBe(1);
    const sameFrame = getVirtualResolutionLayout("auto", 1280, 720);
    expect(layout.contentScale).toBe(sameFrame.contentScale);
    for (const aspect of ["16:9", "16:10", "21:9"] as const) {
      const small = getVirtualResolutionLayout(aspect, 1280, 800);
      const large = getVirtualResolutionLayout(aspect, 2560, 1600);
      expect(large.contentScale / small.contentScale).toBeCloseTo(2);
    }
  });
  it("scales tooltips with Game Size and applies Tooltip Size as a relative adjustment", () => {
    const base = getVirtualResolutionLayout("auto", 3840, 2160);
    const game = getVirtualResolutionLayout("auto", 3840, 2160, { gameSizePercent: 80, tooltipSizePercent: 100 });
    const tooltip = getVirtualResolutionLayout("auto", 3840, 2160, { gameSizePercent: 100, tooltipSizePercent: 125 });
    expect(game.contentScale / base.contentScale).toBeCloseTo(0.8);
    expect(game.tooltipScale / base.tooltipScale).toBeCloseTo(0.8);
    expect(tooltip.contentScale).toBe(base.contentScale);
    expect(tooltip.tooltipScale / base.tooltipScale).toBeCloseTo(1.25);
    expect(tooltip.tooltipStyle["--content-scale" as keyof typeof tooltip.tooltipStyle]).toBe(tooltip.tooltipScale);
  });
  it("bounds and rounds preferences", () => {
    expect(normalizeDisplayPercent("gameSizePercent", 82)).toBe(80);
    expect(normalizeDisplayPercent("gameSizePercent", 500)).toBe(120);
    expect(normalizeDisplayPercent("tooltipSizePercent", 0)).toBe(90);
    expect(normalizeDisplayPercent("tooltipSizePercent", NaN)).toBe(100);
  });
});

describe("adaptive grid capacity", () => {
  it("fits complete columns and keeps two rows", () => {
    expect(getGridCapacity(1200, 244, 20, 8)).toEqual({ columns: 4, pageSize: 8 });
    expect(getGridCapacity(1200, 212, 17, 8)).toEqual({ columns: 5, pageSize: 10 });
    expect(getGridCapacity(9999, 200, 20, 6)).toEqual({ columns: 6, pageSize: 12 });
    expect(getGridCapacity(0, 200, 20, 8)).toEqual({ columns: 1, pageSize: 2 });
  });
  it("retains the first visible or selected item and clamps after removal", () => {
    expect(anchoredPage(2, 8, 10, 40)).toBe(1);
    expect(anchoredPage(2, 8, 10, 40, 23)).toBe(2);
    expect(anchoredPage(4, 8, 10, 12)).toBe(1);
    expect(anchoredPage(4, 8, 10, 0)).toBe(0);
  });
});
