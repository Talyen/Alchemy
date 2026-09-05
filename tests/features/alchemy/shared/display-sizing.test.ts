import { describe, expect, it } from "vitest";
import { getVirtualResolutionLayout } from "@/features/alchemy/shared/hooks";
import { normalizeDisplayPercent } from "@/lib/settings-values";
import { anchoredPage, getGridCapacity } from "@/features/alchemy/shared/ui/adaptive-grid";

describe("display sizing", () => {
  it.each([
    [1280, 720],
    [1470, 956],
    [1512, 982],
    [1920, 1080],
  ])("preserves laptop content at %i x %i", (width, height) => {
    const result = getVirtualResolutionLayout("auto", width, height);
    expect(result.stageContentScale).toBeCloseTo(1, 12);
    expect(parseFloat(result.frameStyle.width)).toBeCloseTo(width);
    expect(parseFloat(result.frameStyle.height)).toBeCloseTo(height);
  });
  it("grows continuously and caps content without capping the stage", () => {
    const reference = getVirtualResolutionLayout("auto", 1920, 1080);
    const nearby = getVirtualResolutionLayout("auto", 1920, 1080.001);
    expect(nearby.contentScale).toBeCloseTo(reference.contentScale, 5);
    const huge = getVirtualResolutionLayout("auto", 7680, 4320);
    expect(huge.contentScale).toBe(1.75);
    expect(huge.stageScale).toBe(4);
    expect(huge.frameStyle.height).toBe("4320px");
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
  });
  it("adjusts game and tooltips independently", () => {
    const base = getVirtualResolutionLayout("auto", 3840, 2160);
    const game = getVirtualResolutionLayout("auto", 3840, 2160, { gameSizePercent: 80, tooltipSizePercent: 100 });
    const tooltip = getVirtualResolutionLayout("auto", 3840, 2160, { gameSizePercent: 100, tooltipSizePercent: 125 });
    expect(game.contentScale / base.contentScale).toBeCloseTo(0.8);
    expect(game.tooltipScale).toBe(base.tooltipScale);
    expect(tooltip.contentScale).toBe(base.contentScale);
    expect(tooltip.tooltipScale).toBe(1.25);
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
