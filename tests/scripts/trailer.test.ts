import fs from "node:fs";
import { pointerPath, samplePointer } from "../../scripts/trailers/direction.mjs";
import { assertFrameDimensions, validateSourceVideo } from "../../scripts/trailers/media.mjs";
import { describe, expect, it, vi } from "vitest";
import { compileTimeline, mapSoundEvents, nativeMusicOffsets, parseRecipe } from "../../scripts/trailers/model.mjs";
import { installCaptureRuntime, sampleVisualTime } from "../../scripts/trailers/browser-runtime.mjs";

const authored = JSON.parse(fs.readFileSync(new URL("../../trailers/boss-spotlight.json", import.meta.url), "utf8"));

describe("trailer edit admission and synchronization", () => {
  it("rejects a 1080p screenshot before it can be passed off as a 4K source", () => {
    const png = Buffer.alloc(24);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
    png.writeUInt32BE(1920, 16);
    png.writeUInt32BE(1080, 20);
    expect(() => assertFrameDimensions(png, 3840, 2160)).toThrow("native 3840×2160");
    expect(() => assertFrameDimensions(png, 1920, 1080)).not.toThrow();
  });
  it("rejects a truncated master using container frame and packet counts", () => {
    const settings = { width: 3840, height: 2160, fps: 60 };
    const video = {
      width: 3840,
      height: 2160,
      codec_name: "h264",
      pix_fmt: "yuv444p",
      r_frame_rate: "60/1",
      nb_frames: "1800",
      nb_read_packets: "1800",
    };
    expect(() => validateSourceVideo(video, settings, 1800)).not.toThrow();
    expect(() => validateSourceVideo({ ...video, nb_read_packets: "1799" }, settings, 1800)).toThrow(
      "packet/frame count",
    );
  });
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
      (
        fakeWindow as typeof fakeWindow & { __trailerCapture: { videoFrameRates: Record<string, number> } }
      ).__trailerCapture.videoFrameRates = { "/waiting.mp4": 10 };
      now = 1750;
      await sampleVisualTime(now);
      expect(waiting.currentTime).toBeCloseTo(0.6, 2);
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
    target.clips[0].actions[0].target = { role: "button", selector: "button" };
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

  it("pins native lyrics to captured battle time and rejects edits that would desynchronize them", () => {
    const recipe = parseRecipe(authored);
    expect(nativeMusicOffsets(recipe)).toEqual({ "forge-golem": 30, "forge-golem-return": 32.4 });
    recipe.shots[3].clip = "forge-golem";
    expect(() => nativeMusicOffsets(recipe)).toThrow("separate clip IDs");
    recipe.shots[3].clip = "forge-golem-return";
    recipe.shots[0].speed = 2;
    expect(() => nativeMusicOffsets(recipe)).toThrow("normal playback speed");
    recipe.music.lyrics = false;
    expect(nativeMusicOffsets(recipe)).toEqual({});
  });

  it("advances native music playback using sampled time while paused audio stays still", async () => {
    let now = 0;
    const fakeWindow = {
      Audio: class {
        src = "http://localhost/Music/countess.mp3";
        pause() {}
      },
    };
    vi.stubGlobal("window", fakeWindow);
    vi.stubGlobal("performance", { now: () => now });
    try {
      installCaptureRuntime();
      const state = (
        fakeWindow as typeof fakeWindow & {
          __trailerCapture: { start: number; music: { src: string; offset: number } };
        }
      ).__trailerCapture;
      state.start = 0;
      state.music = { src: "/Music/countess.mp3", offset: 20.68 };
      const music = new fakeWindow.Audio() as typeof fakeWindow.Audio.prototype & {
        currentTime: number;
        paused: boolean;
        play: () => Promise<void>;
      };
      await music.play();
      expect(music.paused).toBe(false);
      now = 1250;
      expect(music.currentTime).toBeCloseTo(21.93);
      music.pause();
      now = 5000;
      expect(music.paused).toBe(true);
      expect(music.currentTime).toBeCloseTo(21.93);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps the Blood Countess prototype exactly one minute of continuous battle", () => {
    const recipe = parseRecipe(
      JSON.parse(fs.readFileSync(new URL("../../trailers/blood-countess-battle.json", import.meta.url), "utf8")),
    );
    const timeline = compileTimeline(recipe);
    expect(timeline.durationInFrames).toBe(3600);
    expect(recipe.endCard.duration).toBe(0);
    expect(timeline.shots).toHaveLength(1);
    expect(timeline.shots[0].camera).toEqual({ from: { x: 0.5, y: 0.5, zoom: 1 }, to: { x: 0.5, y: 0.5, zoom: 1 } });
    expect(nativeMusicOffsets(recipe)).toEqual({ "blood-countess": 20.68 });
  });
});

it("keeps card-to-card travel above the fan and stays still to play an inspected card", () => {
  const from = { x: 700, y: 1040 },
    to = { x: 1150, y: 1040 };
  const route = pointerPath(from, to, 580);
  for (let frame = 0; frame <= 60; frame++) {
    const point = samplePointer(route, frame / 60);
    if (point.x > from.x && point.x < to.x) expect(point.y).toBeLessThanOrEqual(580);
  }
  expect(pointerPath(from, from, 580)).toEqual([from, from]);
  expect(samplePointer(route, 1)).toEqual(to);
});

it("admits ordered card inspection without allowing ambiguous target sources", () => {
  const recipe = structuredClone(authored);
  recipe.clips[0].actions[0].target = { cardPriority: ["Anvil", "Sunder", "Bash"] };
  expect(parseRecipe(recipe).clips[0].actions[0].target?.cardPriority).toEqual(["Anvil", "Sunder", "Bash"]);
  recipe.clips[0].actions[0].target.role = "button";
  recipe.clips[0].actions[0].target.name = "Play Bash";
  expect(() => parseRecipe(recipe)).toThrow("Specify one");
});
