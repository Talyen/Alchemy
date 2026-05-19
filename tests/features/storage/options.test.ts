import { describe, expect, it } from "vitest";
import { normalizeDisplayMode, normalizeUiScale } from "@/features/alchemy/storage/options";

describe("normalizeDisplayMode", () => {
  it('returns "windowed" when passed "windowed"', () => {
    expect(normalizeDisplayMode("windowed")).toBe("windowed");
  });

  it('returns "borderless-fullscreen" when passed "borderless-fullscreen"', () => {
    expect(normalizeDisplayMode("borderless-fullscreen")).toBe("borderless-fullscreen");
  });

  it('returns "fullscreen" when passed "fullscreen"', () => {
    expect(normalizeDisplayMode("fullscreen")).toBe("fullscreen");
  });

  it("falls back to default for unknown value", () => {
    expect(normalizeDisplayMode("unknown-mode")).toBe("borderless-fullscreen");
  });

  it("falls back to default for undefined", () => {
    expect(normalizeDisplayMode(undefined)).toBe("borderless-fullscreen");
  });

  it("falls back to default for null", () => {
    expect(normalizeDisplayMode(null)).toBe("borderless-fullscreen");
  });
});

describe("normalizeUiScale", () => {
  it('returns "90" when passed "90"', () => {
    expect(normalizeUiScale("90")).toBe("90");
  });

  it('returns "100" when passed "100"', () => {
    expect(normalizeUiScale("100")).toBe("100");
  });

  it('returns "110" when passed "110"', () => {
    expect(normalizeUiScale("110")).toBe("110");
  });

  it('returns "120" when passed "120"', () => {
    expect(normalizeUiScale("120")).toBe("120");
  });

  it("falls back to default for unknown value", () => {
    expect(normalizeUiScale("80")).toBe("100");
  });

  it("falls back to default for undefined", () => {
    expect(normalizeUiScale(undefined)).toBe("100");
  });

  it("falls back to default for null", () => {
    expect(normalizeUiScale(null)).toBe("100");
  });
});
