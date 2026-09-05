import { afterEach, describe, expect, it, vi } from "vitest";
import { isNonPlayerAudioHost } from "@/lib/audio-host";

function stubWindowSize({
  innerWidth,
  innerHeight,
  outerWidth,
  outerHeight,
}: {
  innerWidth: number;
  innerHeight: number;
  outerWidth: number;
  outerHeight: number;
}) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: innerWidth });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: innerHeight });
  Object.defineProperty(window, "outerWidth", { configurable: true, value: outerWidth });
  Object.defineProperty(window, "outerHeight", { configurable: true, value: outerHeight });
}

describe("isNonPlayerAudioHost", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete window.alchemyDesktop;
  });

  it("treats a normal browser window as a player host", () => {
    stubWindowSize({ innerWidth: 1280, innerHeight: 720, outerWidth: 1280, outerHeight: 720 });
    vi.stubGlobal("navigator", { ...navigator, userAgent: "Mozilla/5.0 Chrome/120.0.0.0" });
    expect(isNonPlayerAudioHost()).toBe(false);
  });

  it("treats headless Chromium as a non-player host", () => {
    stubWindowSize({ innerWidth: 1280, innerHeight: 720, outerWidth: 1280, outerHeight: 720 });
    vi.stubGlobal("navigator", { ...navigator, userAgent: "Mozilla/5.0 HeadlessChrome/152.0.0.0" });
    expect(isNonPlayerAudioHost()).toBe(true);
  });

  it("treats WebDriver browsers as non-player hosts", () => {
    stubWindowSize({ innerWidth: 1280, innerHeight: 720, outerWidth: 1280, outerHeight: 720 });
    vi.stubGlobal("navigator", { ...navigator, userAgent: "Mozilla/5.0 Chrome/120.0.0.0", webdriver: true });
    expect(isNonPlayerAudioHost()).toBe(true);
  });

  it("treats Electron without alchemyDesktop as a non-player host", () => {
    stubWindowSize({ innerWidth: 1280, innerHeight: 720, outerWidth: 1280, outerHeight: 720 });
    vi.stubGlobal("navigator", { ...navigator, userAgent: "Mozilla/5.0 Electron/28.0.0" });
    expect(isNonPlayerAudioHost()).toBe(true);
  });

  it("treats Alchemy desktop Electron as a player host", () => {
    stubWindowSize({ innerWidth: 1280, innerHeight: 720, outerWidth: 1280, outerHeight: 720 });
    vi.stubGlobal("navigator", { ...navigator, userAgent: "Mozilla/5.0 Electron/28.0.0" });
    window.alchemyDesktop = { isDesktop: true } as Window["alchemyDesktop"];
    expect(isNonPlayerAudioHost()).toBe(false);
  });

  it("treats a laid-out window with zero outer size as undisplayed", () => {
    stubWindowSize({ innerWidth: 1920, innerHeight: 1080, outerWidth: 0, outerHeight: 0 });
    vi.stubGlobal("navigator", { ...navigator, userAgent: "Mozilla/5.0 Chrome/120.0.0.0" });
    expect(isNonPlayerAudioHost()).toBe(true);
  });

  it("does not treat a zero-size document as undisplayed", () => {
    stubWindowSize({ innerWidth: 0, innerHeight: 0, outerWidth: 0, outerHeight: 0 });
    vi.stubGlobal("navigator", { ...navigator, userAgent: "Mozilla/5.0 Chrome/120.0.0.0" });
    expect(isNonPlayerAudioHost()).toBe(false);
  });
});
