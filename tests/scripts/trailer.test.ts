import fs from "node:fs";
import { pointerPath, samplePointer } from "../../scripts/trailers/direction.mjs";
import {
  assertFrameDimensions,
  CAPTURE_ENCODER_POLICY,
  captureEncoderArgs,
  validateSourceVideo,
} from "../../scripts/trailers/media.mjs";
import { describe, expect, it, vi } from "vitest";
import {
  compileRenderChunks,
  compileTimeline,
  captureOptionsMatch,
  mapSoundEvents,
  nativeMusicOffsets,
  parseRecipe,
} from "../../scripts/trailers/model.mjs";
import { installCaptureRuntime, sampleVisualTime } from "../../scripts/trailers/browser-runtime.mjs";

const authored = JSON.parse(fs.readFileSync(new URL("../../trailers/boss-spotlight.json", import.meta.url), "utf8"));

describe("trailer edit admission and synchronization", () => {
  it("keeps ordinary source capture lossless and requires an explicit bounded policy", () => {
    expect(CAPTURE_ENCODER_POLICY.maxBitrate).toBe(64_000_000);
    expect(CAPTURE_ENCODER_POLICY.bufferBits).toBe(128_000_000);
    expect(captureEncoderArgs(60)).toEqual(["-preset", "ultrafast", "-crf", "0", "-g", "1"]);
    expect(captureEncoderArgs(60, "bounded")).toEqual([
      "-preset",
      "veryfast",
      "-crf",
      "16",
      "-maxrate",
      "64000000",
      "-bufsize",
      "128000000",
      "-g",
      "120",
    ]);
    expect(() => captureEncoderArgs(60, "unknown")).toThrow("Unknown capture encoder policy");
  });
  it("rejects capture option changes when resuming a bundle", () => {
    expect(captureOptionsMatch({}, { encoderPolicy: "lossless" })).toBe(true);
    expect(captureOptionsMatch({ encoderPolicy: "bounded" }, {})).toBe(false);
    expect(captureOptionsMatch({ pinVideoStart: true }, {})).toBe(false);
    expect(captureOptionsMatch({ captureWindows: { clip: [{ id: "a", start: 0, end: 1 }] } }, {})).toBe(false);
    expect(captureOptionsMatch({ encoderPolicy: "bounded" }, { encoderPolicy: "bounded" })).toBe(true);
  });
  it("covers the complete cinematic edit exactly once across bounded render chunks", () => {
    const recipe = parseRecipe(
      JSON.parse(fs.readFileSync(new URL("../../trailers/alchemy-cinematic.json", import.meta.url), "utf8")),
    );
    const timeline = compileTimeline(recipe);
    const chunks = compileRenderChunks(timeline);
    expect(timeline.durationInFrames).toBe(3834);
    expect(chunks).toHaveLength(6);
    expect(chunks[0]).toEqual({ index: 1, from: 0, to: 719 });
    expect(chunks.at(-1)).toEqual({ index: 6, from: 3600, to: 3833 });
    expect(chunks.reduce((total, range) => total + range.to - range.from + 1, 0)).toBe(timeline.durationInFrames);
    for (let index = 1; index < chunks.length; index++) expect(chunks[index].from).toBe(chunks[index - 1].to + 1);
  });
  it("keeps Motion's native fade on the gameplay clock when compositor time is far ahead", async () => {
    let now = 1000;
    class NativeAnimation {
      currentTime = 0;
      playState = "running";
      nativeStart = 0;
      effect = { getComputedTiming: () => ({ endTime: 1050 }) };
      get startTime() {
        return this.nativeStart;
      }
      set startTime(value: number) {
        this.nativeStart = value;
        this.playState = "running";
      }
      pause() {
        this.playState = "paused";
      }
      finish() {
        this.playState = "finished";
      }
    }
    const live: NativeAnimation[] = [];
    class Element {
      animate() {
        const result = new NativeAnimation();
        live.push(result);
        return result;
      }
    }
    const fakeWindow = {
      Audio: class {
        pause() {}
      },
    };
    vi.stubGlobal("window", fakeWindow);
    vi.stubGlobal("performance", { now: () => now });
    vi.stubGlobal("Animation", NativeAnimation);
    vi.stubGlobal("Element", Element);
    vi.stubGlobal("document", { getAnimations: () => live, querySelectorAll: () => [] });
    try {
      installCaptureRuntime();
      const state = (fakeWindow as typeof fakeWindow & { __trailerCapture: { start: number; initialized: boolean } })
        .__trailerCapture;
      state.start = 1000;
      state.initialized = true;
      now = 1500;
      const animation = new Element().animate();
      expect(animation.playState).toBe("paused");
      animation.startTime = now;
      expect(animation.playState).toBe("paused");
      now = 1900;
      await sampleVisualTime(900);
      expect(animation.currentTime).toBe(400);
      expect(animation.playState).toBe("paused");
      now = 2550;
      await sampleVisualTime(1550);
      expect(animation.playState).toBe("finished");
    } finally {
      vi.unstubAllGlobals();
    }
  });
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
  it("samples rounded capture clocks and preserves paused buffer rewinds across clip changes", async () => {
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
      const state = fakeWindow as typeof fakeWindow & {
        __trailerCapture: { videoFrameRates: Record<string, number> };
      };
      state.__trailerCapture.videoFrameRates = { "/waiting.mp4": 60 };
      // Playwright's clock rounds 60 Hz samples to integer milliseconds. A
      // 533 ms sample still represents frame 32, rather than repeating frame 31.
      now = 1617;
      await sampleVisualTime(now);
      expect(waiting.currentTime).toBeCloseTo(31.5 / 60, 5);
      now = 1633;
      await sampleVisualTime(now);
      expect(waiting.currentTime).toBeCloseTo(32.5 / 60, 5);
      (
        fakeWindow as typeof fakeWindow & { __trailerCapture: { videoFrameRates: Record<string, number> } }
      ).__trailerCapture.videoFrameRates = { "/waiting.mp4": 10 };
      now = 1750;
      await sampleVisualTime(now);
      expect(waiting.currentTime).toBeCloseTo(0.65, 2);
      state.__trailerCapture.videoFrameRates = { "/waiting.mp4": 60 };
      now = 18067;
      active.currentTime = 0;
      waiting.currentTime = 0;
      await waiting.play();
      now = 18283;
      await sampleVisualTime(now);
      expect(active.currentTime).toBe(0);
      expect(waiting.currentTime).toBeCloseTo(13.5 / 60, 5);
      let present: ((time: number, metadata: { mediaTime: number }) => void) | undefined;
      Object.assign(waiting, {
        requestVideoFrameCallback(callback: typeof present) {
          present = callback;
          return 1;
        },
        cancelVideoFrameCallback() {},
      });
      vi.stubGlobal("getComputedStyle", (video: Video) => ({ opacity: video === waiting ? "1" : "0", zIndex: "2" }));
      now = 18300;
      let sampled = false;
      const pending = sampleVisualTime(now).then(() => {
        sampled = true;
      });
      await Promise.resolve();
      expect(sampled).toBe(false);
      present!(0, { mediaTime: 13 / 60 });
      expect(sampled).toBe(false);
      present!(0, { mediaTime: 14 / 60 });
      await pending;
      expect(sampled).toBe(true);
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

  it("carries the native lyric clock through a menu take that resumes a saved boss", () => {
    const recipe = JSON.parse(
      fs.readFileSync(new URL("../../trailers/blood-countess-battle.json", import.meta.url), "utf8"),
    );
    recipe.music.offset = 18.68;
    recipe.clips[0].scene = "menu";
    recipe.clips[0].checkpoint = "isolated-countess-ready.json";
    expect(nativeMusicOffsets(parseRecipe(recipe))).toEqual({ "blood-countess": 18.68 });
    delete recipe.clips[0].checkpoint;
    expect(nativeMusicOffsets(parseRecipe(recipe))).toEqual({});
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
