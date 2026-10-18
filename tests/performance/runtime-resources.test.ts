import { afterEach, expect, it, vi } from "vitest";
import type { Page } from "@playwright/test";
import { installRuntimeResourceProbe, requireSettledResources } from "../../performance/runtime-resources";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("distinguishes completed playback from retained detached audio and releases its observation", async () => {
  vi.useFakeTimers({ toFake: ["performance"] });
  class Media extends EventTarget {
    loop = false;
    src = "http://localhost/sounds/hit.ogg";
    paused = false;
    ended = false;
    duration = 1;
    play() {
      return Promise.resolve();
    }
    removeAttribute(name: string) {
      if (name === "src") this.src = "";
    }
  }
  const probeWindow: {
    __alchemyResourceProbe?: () => {
      sfxPlayAttempts: number;
      completedSfx: number;
      activeSfx: number;
      retainedSfx: number;
      overdueSfx: number;
      ownedAnimations: number;
    };
  } = {};
  vi.stubGlobal("window", probeWindow);
  vi.stubGlobal("document", { querySelectorAll: () => [] });
  vi.stubGlobal("HTMLMediaElement", Media);
  await installRuntimeResourceProbe({ addInitScript: async (install: () => void) => install() } as unknown as Page);
  const cue = new Media();
  await cue.play();
  expect(probeWindow.__alchemyResourceProbe!()).toMatchObject({
    sfxPlayAttempts: 1,
    completedSfx: 0,
    activeSfx: 1,
    retainedSfx: 1,
  });
  cue.ended = true;
  cue.paused = true;
  cue.dispatchEvent(new Event("ended"));
  vi.advanceTimersByTime(3000);
  const retained = probeWindow.__alchemyResourceProbe!();
  expect(retained).toMatchObject({ completedSfx: 1, activeSfx: 0, retainedSfx: 1, overdueSfx: 1 });
  expect(() => requireSettledResources(retained)).toThrow("Unreleased action resources");
  cue.removeAttribute("src");
  expect(probeWindow.__alchemyResourceProbe!()).toMatchObject({ completedSfx: 1, retainedSfx: 0, overdueSfx: 0 });
});
