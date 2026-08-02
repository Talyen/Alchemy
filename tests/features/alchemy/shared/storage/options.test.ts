import { describe, expect, it } from "vitest";
import { normalizeDisplayMode } from "@/features/alchemy/shared/storage/options";

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
