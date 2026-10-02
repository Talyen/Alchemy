/**
 * Shared browser harness for the audio E2E journey (`audio-sfx.spec.ts` covers
 * menu SFX). Pretends to be a player host (non-headless user agent) and then
 * observes `Audio` playback without sounding anything.
 */
import type { Page } from "@playwright/test";

// Mirrors SOUNDS_BASE_PATH casing in game-constants/audio.ts.
const SFX_SRC_MARKER = "/sounds/";

async function pretendPlayerHost(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const userAgent = navigator.userAgent;
    Object.defineProperty(navigator, "webdriver", { configurable: true, get: () => false });
    // Headless CI can expose a zero-size outer window even with a visible
    // viewport. Model a normal player window for this real-media journey.
    Object.defineProperty(window, "outerWidth", { configurable: true, get: () => window.innerWidth });
    Object.defineProperty(window, "outerHeight", { configurable: true, get: () => window.innerHeight });
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      get: () => userAgent.replace("HeadlessChrome", "Chrome"),
    });
  });
}

/** Counts successfully started SFX, including media loading and play rejection. */
export async function trackSfxPlays(page: Page): Promise<void> {
  await pretendPlayerHost(page);
  await page.addInitScript((marker: string) => {
    const runtime = window as Window & { __alchemySfxPlays?: number };
    runtime.__alchemySfxPlays = 0;
    const NativeAudio = window.Audio;
    window.Audio = class extends NativeAudio {
      constructor(src?: string) {
        super(src);
        const origPlay = this.play.bind(this);
        this.play = async () => {
          // Completion cleanup can release a short cue's src before this
          // observer resumes. A fulfilled play promise confirms startup.
          const isSfx = this.src.includes(marker);
          await origPlay();
          if (isSfx) {
            runtime.__alchemySfxPlays = (runtime.__alchemySfxPlays ?? 0) + 1;
          }
        };
      }
    };
  }, SFX_SRC_MARKER);
}

export async function readSfxPlays(page: Page): Promise<number> {
  return page.evaluate(() => (window as Window & { __alchemySfxPlays?: number }).__alchemySfxPlays ?? 0);
}

export async function resetSfxPlays(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as Window & { __alchemySfxPlays?: number }).__alchemySfxPlays = 0;
  });
}
