import { afterEach, describe, expect, it, vi } from "vitest";
import { prefersReducedMotion, shouldReduceMotion } from "@/lib/animation/animation-prefs";

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("animation preferences", () => {
  it("honors either the game setting or the live OS preference, including changes after setup", () => {
    localStorage.clear();
    const query = { matches: false };
    const matchMedia = vi.fn(() => query);
    vi.stubGlobal("matchMedia", matchMedia);

    expect(shouldReduceMotion()).toBe(false);
    localStorage.setItem("alchemy-disable-animations", "true");
    expect(shouldReduceMotion()).toBe(true);
    localStorage.setItem("alchemy-disable-animations", "false");
    expect(shouldReduceMotion()).toBe(false);
    query.matches = true;
    expect(shouldReduceMotion()).toBe(true);
    query.matches = false;
    expect(shouldReduceMotion()).toBe(false);
    expect(matchMedia).toHaveBeenCalledExactlyOnceWith("(prefers-reduced-motion: reduce)");
  });

  it("rebinds to a replaced media-query provider instead of retaining a stale preference", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true })),
    );
    expect(prefersReducedMotion()).toBe(true);
    const replacement = vi.fn(() => ({ matches: false }));
    vi.stubGlobal("matchMedia", replacement);
    expect(prefersReducedMotion()).toBe(false);
    expect(replacement).toHaveBeenCalledExactlyOnceWith("(prefers-reduced-motion: reduce)");
  });

  it("keeps animation setup usable when storage is blocked and still honors the OS preference", () => {
    const query = { matches: false };
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => query),
    );
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(shouldReduceMotion()).toBe(false);
    query.matches = true;
    expect(shouldReduceMotion()).toBe(true);
  });

  it("honors the game setting when the browser has no media-query API", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(shouldReduceMotion()).toBe(false);
    localStorage.setItem("alchemy-disable-animations", "true");
    expect(shouldReduceMotion()).toBe(true);
  });
});
