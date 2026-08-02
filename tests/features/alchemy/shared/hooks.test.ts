import { describe, it, expect } from "vitest";
import { getVirtualResolutionLayout, resolveAutoAspectRatio } from "@/features/alchemy/shared/hooks";

describe("resolveAutoAspectRatio", () => {
  it("returns 16:9 for 1920x1080", () => {
    expect(resolveAutoAspectRatio(1920, 1080)).toBe("16:9");
  });

  it("returns 16:10 for 1920x1200", () => {
    expect(resolveAutoAspectRatio(1920, 1200)).toBe("16:10");
  });

  it("returns 16:10 for 1280x800", () => {
    expect(resolveAutoAspectRatio(1280, 800)).toBe("16:10");
  });

  it("returns 21:9 for 2560x1080", () => {
    expect(resolveAutoAspectRatio(2560, 1080)).toBe("21:9");
  });

  it("returns 21:9 for 3440x1440", () => {
    expect(resolveAutoAspectRatio(3440, 1440)).toBe("21:9");
  });

  it("returns 16:10 for 2560x1600", () => {
    expect(resolveAutoAspectRatio(2560, 1600)).toBe("16:10");
  });

  it("returns 16:9 for 3840x2160 (4K)", () => {
    expect(resolveAutoAspectRatio(3840, 2160)).toBe("16:9");
  });

  it("returns 16:9 for 1366x768", () => {
    expect(resolveAutoAspectRatio(1366, 768)).toBe("16:9");
  });

  it("returns 16:9 for 1600x900", () => {
    expect(resolveAutoAspectRatio(1600, 900)).toBe("16:9");
  });
});

describe("getVirtualResolutionLayout", () => {
  it("keeps native 16:9 windows at scale 1", () => {
    const layout = getVirtualResolutionLayout("16:9", 1920, 1080);
    const transformScale = Number(layout.stageStyle.transform.match(/^scale\(([^)]+)\)$/)?.[1]);

    expect(transformScale).toBe(1);
    expect(parseFloat(layout.frameStyle.width)).toBe(1920);
    expect(parseFloat(layout.frameStyle.height)).toBe(1080);
    expect(layout.stagePixelRatio).toBe(1);
  });

  it("uses one proportional logical stage at 4K", () => {
    const layout = getVirtualResolutionLayout("16:9", 3840, 2160);
    const transformScale = Number(layout.stageStyle.transform.match(/^scale\(([^)]+)\)$/)?.[1]);

    expect(layout.stagePixelRatio).toBe(1);
    expect(layout.stageStyle.width).toBe("1920px");
    expect(layout.stageStyle.height).toBe("1080px");
    expect(transformScale).toBe(2);
    expect(parseFloat(layout.frameStyle.width)).toBe(3840);
    expect(parseFloat(layout.frameStyle.height)).toBe(2160);
  });

  it("preserves fixed-rem proportions between standard and native rendering", () => {
    const standard = getVirtualResolutionLayout("16:9", 1920, 1080);
    const ultraHd = getVirtualResolutionLayout("16:9", 3840, 2160);

    function fixedRemToFrameHeight(layout: ReturnType<typeof getVirtualResolutionLayout>) {
      const transformScale = Number(layout.stageStyle.transform.match(/^scale\(([^)]+)\)$/)?.[1]);
      const visualRem = 16 * transformScale;
      return visualRem / parseFloat(layout.frameStyle.height);
    }

    expect(fixedRemToFrameHeight(ultraHd)).toBeCloseTo(fixedRemToFrameHeight(standard), 8);
  });

  it("selects and fits a MacBook-shaped 16:10 stage", () => {
    const layout = getVirtualResolutionLayout("auto", 1512, 982);
    const transformScale = Number(layout.stageStyle.transform.match(/^scale\(([^)]+)\)$/)?.[1]);

    expect(layout.aspectMode).toBe("narrow");
    expect(parseFloat(layout.frameStyle.width)).toBe(1512);
    expect(parseFloat(layout.frameStyle.height)).toBeLessThanOrEqual(982);
    expect(transformScale).toBeLessThan(1);
  });
});
