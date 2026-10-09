import { afterEach, expect, it, vi } from "vitest";
import type { Page } from "@playwright/test";
import { createSfxPlayer } from "@/lib/audio/sfx-player";
import { installRuntimeResourceProbe, requireSettledResources } from "../../performance/runtime-resources";

const nativePlay = HTMLMediaElement.prototype.play;
const nativeRemove = HTMLMediaElement.prototype.removeAttribute;
function probe() {
  return (
    window as unknown as {
      __alchemyResourceProbe: () => { retainedSfx: number; overdueSfx: number; ownedAnimations: number };
    }
  ).__alchemyResourceProbe();
}
async function install() {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  await installRuntimeResourceProbe({ addInitScript: async (callback: () => void) => callback() } as unknown as Page);
}

afterEach(() => {
  vi.restoreAllMocks();
  HTMLMediaElement.prototype.play = nativePlay;
  HTMLMediaElement.prototype.removeAttribute = nativeRemove;
  delete (window as unknown as { __alchemyResourceProbe?: unknown }).__alchemyResourceProbe;
});

it("observes a detached cue and releases it through the actual SFX cleanup owner", async () => {
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  await install();
  const player = createSfxPlayer({
    createElement: () => {
      const media = document.createElement("audio");
      media.src = "/sounds/cue.ogg";
      return media;
    },
    readSettings: () => ({ muted: false, sfxVolume: 1, masterVolume: 1 }),
    now: () => 0,
    schedule: setTimeout,
    cancel: clearTimeout,
  });
  player.play("cue");
  expect(document.querySelectorAll("audio")).toHaveLength(0);
  expect(probe().retainedSfx).toBe(1);
  player.stopBattleSounds();
  expect(probe().retainedSfx).toBe(0);
  expect(() => requireSettledResources(probe())).not.toThrow();
});

it("a finished detached cue remains a leak until its source is released", async () => {
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  await install();
  const media = document.createElement("audio");
  media.src = "/sounds/cue.ogg";
  await media.play();
  media.dispatchEvent(new Event("ended"));
  now = 2001;
  expect(document.querySelectorAll("audio")).toHaveLength(0);
  expect(probe().overdueSfx).toBe(1);
  expect(() => requireSettledResources(probe())).toThrow("Unreleased action resources");
  media.removeAttribute("src");
  expect(probe().retainedSfx).toBe(0);
});
