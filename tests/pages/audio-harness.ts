/**
 * Shared browser harness for the audio E2E journey (`audio-sfx.spec.ts` covers
 * menu SFX plus the bestiary boss-music flow). Both trackers pretend to be a
 * player host (non-headless user agent) and then observe `Audio` playback
 * without sounding anything. Kept here so the SFX and music trackers cannot
 * drift apart.
 */
import type { Page } from "@playwright/test";

// Mirrors SOUNDS_BASE_PATH / MUSIC_BASE_PATH casing in game-constants/audio.ts.
const SFX_SRC_MARKER = "/sounds/";
const MUSIC_SRC_MARKER = "/Music/";

async function pretendPlayerHost(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const userAgent = navigator.userAgent;
    Object.defineProperty(navigator, "webdriver", { configurable: true, get: () => false });
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      get: () => userAgent.replace("HeadlessChrome", "Chrome"),
    });
  });
}

/** Counts `/sounds/` plays in `window.__alchemySfxPlays`. */
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
        this.play = () => {
          if (this.src.includes(marker)) {
            runtime.__alchemySfxPlays = (runtime.__alchemySfxPlays ?? 0) + 1;
          }
          return origPlay();
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

/** Tracks `/Music/` elements without sounding them. */
export async function trackActiveMusic(page: Page): Promise<void> {
  await pretendPlayerHost(page);
  await page.addInitScript((marker: string) => {
    const runtime = window as Window & {
      __alchemyActiveMusic?: Set<HTMLAudioElement>;
    };
    runtime.__alchemyActiveMusic = new Set();
    const NativeAudio = window.Audio;
    window.Audio = class extends NativeAudio {
      constructor(src?: string) {
        super(src);
        if (!src?.includes(marker)) return;
        const nativePause = this.pause.bind(this);
        this.play = () => {
          runtime.__alchemyActiveMusic?.add(this);
          return Promise.resolve();
        };
        this.pause = () => {
          runtime.__alchemyActiveMusic?.delete(this);
          nativePause();
        };
      }
    };
  }, MUSIC_SRC_MARKER);
}

export function activeMusic(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...((window as Window & { __alchemyActiveMusic?: Set<HTMLAudioElement> }).__alchemyActiveMusic ?? [])].map(
      (audio) => decodeURIComponent(audio.src),
    ),
  );
}
