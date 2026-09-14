import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ANIMATION_DISABLED_DURATION,
  isAnimationDisabled,
  prefersReducedMotion,
  shouldReduceMotion,
} from "@/lib/animation/animation-prefs";

describe("animation-prefs", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("exports ANIMATION_DISABLED_DURATION as 1ms", () => {
    expect(ANIMATION_DISABLED_DURATION).toBe(1);
  });

  describe("isAnimationDisabled", () => {
    it("returns false by default when localStorage has no flag", () => {
      expect(isAnimationDisabled()).toBe(false);
    });

    it("returns true when alchemy-disable-animations is 'true'", () => {
      localStorage.setItem("alchemy-disable-animations", "true");
      expect(isAnimationDisabled()).toBe(true);
    });

    it("returns false when alchemy-disable-animations has any other value", () => {
      localStorage.setItem("alchemy-disable-animations", "false");
      expect(isAnimationDisabled()).toBe(false);
      localStorage.setItem("alchemy-disable-animations", "1");
      expect(isAnimationDisabled()).toBe(false);
    });
  });

  describe("prefersReducedMotion", () => {
    it("returns false when matchMedia is not a function", () => {
      vi.stubGlobal("matchMedia", undefined);
      expect(prefersReducedMotion()).toBe(false);
    });

    it("returns true when prefers-reduced-motion matches", () => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn((query: string) => ({
          matches: query.includes("reduce"),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      );
      expect(prefersReducedMotion()).toBe(true);
    });

    it("returns false when prefers-reduced-motion does not match", () => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn((query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      );
      expect(prefersReducedMotion()).toBe(false);
    });
  });

  describe("shouldReduceMotion", () => {
    it("returns false when neither setting is enabled", () => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: false })),
      );
      expect(shouldReduceMotion()).toBe(false);
    });

    it("returns true when isAnimationDisabled is true", () => {
      localStorage.setItem("alchemy-disable-animations", "true");
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: false })),
      );
      expect(shouldReduceMotion()).toBe(true);
    });

    it("returns true when prefersReducedMotion is true", () => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn((query: string) => ({ matches: query.includes("reduce") })),
      );
      expect(shouldReduceMotion()).toBe(true);
    });
  });
});
