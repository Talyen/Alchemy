import { describe, it, expect } from "vitest";
import { resolveAutoAspectRatio } from "@/features/alchemy/hooks";

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
