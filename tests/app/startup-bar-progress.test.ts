import { describe, expect, it } from "vitest";
import { advanceStartupBar, computeStartupLoadTarget } from "@/app/startup-bar-progress";
import { STARTUP_BAR_INCOMPLETE_CAP, STARTUP_LOAD_FONT_WEIGHT, STARTUP_LOAD_IMAGE_WEIGHT } from "@/lib/game-constants";

describe("computeStartupLoadTarget", () => {
  it("weights image, font, and bootstrap work", () => {
    expect(
      computeStartupLoadTarget({
        imageLoaded: 0,
        imageTotal: 10,
        fontsReady: false,
        bootstrapReady: false,
      }),
    ).toBe(0);

    expect(
      computeStartupLoadTarget({
        imageLoaded: 5,
        imageTotal: 10,
        fontsReady: true,
        bootstrapReady: false,
      }),
    ).toBeCloseTo(STARTUP_LOAD_IMAGE_WEIGHT * 0.5 + STARTUP_LOAD_FONT_WEIGHT, 5);
  });

  it("treats an empty image list as fully loaded", () => {
    expect(
      computeStartupLoadTarget({
        imageLoaded: 0,
        imageTotal: 0,
        fontsReady: true,
        bootstrapReady: true,
      }),
    ).toBe(1);
  });

  it("caps below 1 until images, fonts, and bootstrap are all done", () => {
    const target = computeStartupLoadTarget({
      imageLoaded: 10,
      imageTotal: 10,
      fontsReady: true,
      bootstrapReady: false,
    });
    expect(target).toBeLessThanOrEqual(STARTUP_BAR_INCOMPLETE_CAP);
    expect(target).toBeCloseTo(STARTUP_LOAD_IMAGE_WEIGHT + STARTUP_LOAD_FONT_WEIGHT, 5);
  });

  it("reaches 1 only when every gate is complete", () => {
    expect(
      computeStartupLoadTarget({
        imageLoaded: 10,
        imageTotal: 10,
        fontsReady: true,
        bootstrapReady: true,
      }),
    ).toBe(1);
  });
});

describe("advanceStartupBar", () => {
  it("chases the target without jumping to it in one frame", () => {
    const next = advanceStartupBar(0, 0.016, 0.5, false);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(0.5);
  });

  it("never decreases", () => {
    const next = advanceStartupBar(0.4, 0.016, 0.1, false);
    expect(next).toBeGreaterThanOrEqual(0.4);
  });

  it("trickles toward the cap when display has caught the stalled target", () => {
    const stalled = 0.2;
    const next = advanceStartupBar(stalled, 0.25, stalled, false);
    expect(next).toBeGreaterThan(stalled);
    expect(next).toBeLessThanOrEqual(STARTUP_BAR_INCOMPLETE_CAP);
  });

  it("does not pass the incomplete cap until work is complete", () => {
    let display = 0.9;
    for (let i = 0; i < 40; i += 1) {
      display = advanceStartupBar(display, 0.05, 0.9, false);
    }
    expect(display).toBeLessThanOrEqual(STARTUP_BAR_INCOMPLETE_CAP);
  });

  it("can fill to 1 once work is complete", () => {
    let display = 0.9;
    for (let i = 0; i < 40; i += 1) {
      display = advanceStartupBar(display, 0.05, 1, true);
    }
    expect(display).toBeGreaterThan(0.99);
    expect(display).toBeLessThanOrEqual(1);
  });
});
