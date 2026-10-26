import { anchoredPage } from "@/features/alchemy/shared/ui/pagination";
import { describe, expect, it } from "vitest";
import { getVirtualResolutionLayout } from "@/features/alchemy/shared/ui/use-virtual-resolution";
import { getGridCapacity } from "@/features/alchemy/shared/ui/adaptive-grid";

describe("display sizing", () => {
  it("keeps content equally sized at the same height across standard and wide aspects", () => {
    for (const height of [720, 1080, 1440, 2160]) {
      const standard = getVirtualResolutionLayout((height * 16) / 9, height);
      for (const aspect of [21 / 9, 32 / 9]) {
        const wide = getVirtualResolutionLayout(height * aspect, height);
        expect(wide.contentScale).toBeCloseTo(standard.contentScale, 12);
        expect(wide.tooltipScale).toBeCloseTo(standard.tooltipScale, 12);
      }
    }
  });
  it("fits narrow windows by width and gives taller windows extra playing space", () => {
    for (const [width, height] of [
      [1024, 768],
      [1280, 800],
      [1500, 1000],
      [1920, 1200],
    ]) {
      const narrow = getVirtualResolutionLayout(width!, height!);
      const standard = getVirtualResolutionLayout(width!, (width! * 9) / 16);
      expect(narrow.contentScale).toBeCloseTo(standard.contentScale, 12);
    }
  });
  it("scales continuously around 720p and keeps growing without a hard cap", () => {
    const reference = getVirtualResolutionLayout(1280, 720);
    for (const height of [719.999, 720.001]) {
      expect(getVirtualResolutionLayout((height * 16) / 9, height).contentScale).toBeCloseTo(reference.contentScale, 5);
    }
    const fullHd = getVirtualResolutionLayout(1920, 1080);
    const fourK = getVirtualResolutionLayout(3840, 2160);
    expect(fourK.contentScale).toBeGreaterThan(fullHd.contentScale);
    expect(fourK.contentScale / fullHd.contentScale).toBeLessThan(2);
  });
  it.each([
    [0, 0],
    [0, 720],
    [1280, 0],
    [NaN, Infinity],
  ])("handles unavailable geometry %i x %i", (width, height) => {
    const layout = getVirtualResolutionLayout(width, height);
    expect(Number.isFinite(layout.stageContentScale)).toBe(true);
    expect(Number.isFinite(layout.stageScale)).toBe(true);
  });
  it.each([
    [1024, 768, "narrow"],
    [1280, 720, "standard"],
    [1280, 800, "narrow"],
    [1500, 1000, "narrow"],
    [1920, 1080, "standard"],
    [2560, 1440, "standard"],
    [3840, 2160, "standard"],
    [3840, 1080, "ultrawide"],
    [1920, 1200, "narrow"],
    [1080, 1920, "narrow"],
    [3440, 1440, "ultrawide"],
  ] as const)("fills %i x %i at both Game Size extremes", (width, height, aspectMode) => {
    for (const gameSizePercent of [80, 120]) {
      const layout = getVirtualResolutionLayout(width, height, { gameSizePercent, tooltipSizePercent: 100 });
      expect(layout.frameStyle.width).toBe(`${width}px`);
      expect(layout.frameStyle.height).toBe(`${height}px`);
      expect(parseFloat(layout.stageStyle.width) * layout.stageScale).toBeCloseTo(width);
      expect(parseFloat(layout.stageStyle.height) * layout.stageScale).toBeCloseTo(height);
      expect(layout.aspectMode).toBe(aspectMode);
      expect(layout.stagePixelRatio).toBe(1);
    }
  });
  it("scales tooltips with Game Size and applies Tooltip Size as a relative adjustment", () => {
    const base = getVirtualResolutionLayout(3840, 2160);
    const game = getVirtualResolutionLayout(3840, 2160, { gameSizePercent: 80, tooltipSizePercent: 100 });
    const tooltip = getVirtualResolutionLayout(3840, 2160, { gameSizePercent: 100, tooltipSizePercent: 125 });
    expect(game.contentScale / base.contentScale).toBeCloseTo(0.8);
    expect(game.tooltipScale / base.tooltipScale).toBeCloseTo(0.8);
    expect(tooltip.contentScale).toBe(base.contentScale);
    expect(tooltip.tooltipScale / base.tooltipScale).toBeCloseTo(1.25);
    expect(tooltip.tooltipStyle["--content-scale" as keyof typeof tooltip.tooltipStyle]).toBe(tooltip.tooltipScale);
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
