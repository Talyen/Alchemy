import fs from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { compileTimeline, lyricAt, mapSoundEvents, parseRecipe } from "../../scripts/trailers/model.mjs";
import { installCaptureRuntime, sampleVisualTime } from "../../scripts/trailers/browser-runtime.mjs";

const authored = JSON.parse(fs.readFileSync(new URL("../../trailers/boss-spotlight.json", import.meta.url), "utf8"));

describe("trailer edit admission and synchronization", () => {
  it("holds paused preload videos and the outgoing last frame while switching playback once", async () => {
    class Video extends EventTarget {
      src: string;
      paused = true;
      duration = 1;
      loop = false;
      playbackRate = 1;
      error = null;
      position = 0;
      constructor(src: string) {
        super();
        this.src = src;
      }
      get currentTime() {
        return this.position;
      }
      set currentTime(value: number) {
        this.position = value;
        queueMicrotask(() => this.dispatchEvent(new Event("seeked")));
      }
      play() {
        this.paused = false;
        return Promise.resolve();
      }
      pause() {
        this.paused = true;
      }
    }
    const active = new Video("active.mp4");
    const waiting = new Video("waiting.mp4");
    let now = 0;
    let ended = 0;
    const fakeWindow = {
      Audio: class {
        pause() {}
      },
    };
    vi.stubGlobal("window", fakeWindow);
    vi.stubGlobal("HTMLVideoElement", Video);
    vi.stubGlobal("document", { getAnimations: () => [], querySelectorAll: () => [active, waiting] });
    vi.stubGlobal("performance", { now: () => now });
    try {
      installCaptureRuntime();
      (fakeWindow as typeof fakeWindow & { __trailerCapture: { start: number } }).__trailerCapture.start = 0;
      active.addEventListener("ended", () => {
        ended++;
        void waiting.play();
      });
      await active.play();
      await sampleVisualTime(0);
      now = 500;
      await sampleVisualTime(now);
      expect(active.currentTime).toBeCloseTo(0.5);
      expect(waiting.currentTime).toBe(0);
      now = 1100;
      await sampleVisualTime(now);
      now = 1200;
      await sampleVisualTime(now);
      expect(ended).toBe(1);
      expect(active.currentTime).toBeCloseTo(1);
      expect(waiting.currentTime).toBeCloseTo(0.1);
      now = 1500;
      await sampleVisualTime(now);
      expect(ended).toBe(1);
      expect(active.currentTime).toBeCloseTo(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("uses the controlled clock installed after audio interception for cue starts and stops", async () => {
    const fakeWindow = {
      Audio: class {
        src = "http://localhost/sounds/impact.ogg";
        muted = false;
        volume = 0.7;
        currentTime = 0;
        play() {
          return Promise.resolve();
        }
        pause() {}
      },
    };
    vi.stubGlobal("window", fakeWindow);
    vi.stubGlobal("performance", { now: () => 99_000 });
    try {
      installCaptureRuntime();
      const state = (
        fakeWindow as typeof fakeWindow & {
          __trailerCapture: { start: number; sounds: Array<{ at: number; end: number; volume: number }> };
        }
      ).__trailerCapture;
      state.start = 1000;
      vi.stubGlobal("performance", { now: () => 2250 });
      const cue = new fakeWindow.Audio();
      await cue.play();
      vi.stubGlobal("performance", { now: () => 2500 });
      cue.pause();
      expect(state.sounds).toMatchObject([{ at: 1.25, end: 1.5, volume: 0.7 }]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("rejects unavailable footage, duplicate captures, and malformed direction before recording", () => {
    const overrun = structuredClone(authored);
    overrun.shots[0].in = 15;
    expect(() => parseRecipe(overrun)).toThrow("exceeds captured footage");
    const duplicate = structuredClone(authored);
    duplicate.clips.push(duplicate.clips[0]);
    expect(() => parseRecipe(duplicate)).toThrow("Duplicate clip");
    const target = structuredClone(authored);
    target.clips[0].actions[0].target = { role: "button", name: "Play", selector: "button" };
    expect(() => parseRecipe(target)).toThrow("Specify one");
  });

  it("accounts for transition overlap in exact frames without changing timing for drafts or social formats", () => {
    const recipe = parseRecipe(authored);
    const steam = compileTimeline(recipe);
    expect(steam.shots.map((shot) => shot.from)).toEqual([0, 240, 459, 624]);
    expect(steam.endCardFrom).toBe(1104);
    expect(steam.durationInFrames).toBe(1284);
    const vertical = compileTimeline(recipe, "vertical", true);
    expect(vertical.width).toBe(540);
    expect(vertical.height).toBe(960);
    expect(vertical.durationInFrames).toBe(steam.durationInFrames);
    expect(vertical.fps).toBe(60);
  });

  it("rejects impossible transitions instead of silently shifting the edit", () => {
    const recipe = structuredClone(authored);
    recipe.shots[0].transition = { kind: "dissolve", duration: 1 };
    expect(() => parseRecipe(recipe)).toThrow("First shot");
    recipe.shots[0].transition = { kind: "cut", duration: 1 };
    expect(() => parseRecipe(recipe)).toThrow("Cuts cannot overlap");
  });

  it("maps cues to the edited source interval, playback speed, and cut boundary", () => {
    const recipe = parseRecipe(authored);
    recipe.shots = [{ ...recipe.shots[0], in: 4, duration: 2, speed: 2 }];
    const events = mapSoundEvents(compileTimeline(recipe), {
      "forge-golem": {
        sounds: [
          { file: "early.mp3", at: 3, end: 5, volume: 1 },
          { file: "impact.mp3", at: 5, end: 10, volume: 0.5 },
          { file: "late.mp3", at: 8, end: 9, volume: 1 },
        ],
      },
    });
    expect(events).toEqual([{ file: "impact.mp3", at: 0.5, end: 10, volume: 0.5, duration: 1.5, speed: 2 }]);
  });

  it("reveals lyrics from soundtrack timestamps and clears instrumental gaps", () => {
    const lines = [{ text: "Iron Bear", timings: [30, 31, 31.5, 33] }];
    expect(lyricAt(lines, 29.99)).toEqual([]);
    expect(lyricAt(lines, 30.5)).toEqual([{ text: "Iron", active: true }]);
    expect(lyricAt(lines, 31.25)).toEqual([{ text: "Iron", active: false }]);
    expect(lyricAt(lines, 32)).toEqual([
      { text: "Iron", active: false },
      { text: "Bear", active: true },
    ]);
    expect(lyricAt(lines, 33)).toEqual([]);
  });
});
