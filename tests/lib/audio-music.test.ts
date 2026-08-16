import { expect, it, beforeEach, vi, afterEach } from "vitest";
import { applyMusicVolume, invalidateCacheForKey, playMusic, playMusicImmediate } from "@/lib/audio-music";
import { audioState } from "@/lib/audio-state";
import { MUSIC_KEYS, MUSIC_MASTER_GAIN } from "@/lib/game-constants";

beforeEach(() => {
  audioState.musicVolume = 0.5;
  audioState.masterVolume = 1;
  audioState.currentMusicKey = null;
  audioState.currentMusic = null;
  invalidateCacheForKey(MUSIC_KEYS.MENU);
  invalidateCacheForKey(MUSIC_KEYS.BATTLE);
  invalidateCacheForKey(MUSIC_KEYS.BOSS_FORGE_GOLEM);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("applies combined volume to an audio element", () => {
  const el = { volume: 0 } as HTMLAudioElement;
  applyMusicVolume(el);
  expect(el.volume).toBe(0.5 * 1 * MUSIC_MASTER_GAIN);
});

it("respects master volume changes", () => {
  audioState.masterVolume = 0.5;
  const el = { volume: 0 } as HTMLAudioElement;
  applyMusicVolume(el);
  expect(el.volume).toBe(0.5 * 0.5 * MUSIC_MASTER_GAIN);
});

it("respects music volume changes", () => {
  audioState.musicVolume = 0.25;
  const el = { volume: 0 } as HTMLAudioElement;
  applyMusicVolume(el);
  expect(el.volume).toBe(0.25 * 1 * MUSIC_MASTER_GAIN);
});

it("handles zero volume", () => {
  audioState.musicVolume = 0;
  const el = { volume: 1 } as HTMLAudioElement;
  applyMusicVolume(el);
  expect(el.volume).toBe(0);
});

it("handles full volume", () => {
  audioState.musicVolume = 1;
  audioState.masterVolume = 1;
  const el = { volume: 0 } as HTMLAudioElement;
  applyMusicVolume(el);
  expect(el.volume).toBe(1 * 1 * MUSIC_MASTER_GAIN);
});

it("applies the boss volume boost", () => {
  const el = { volume: 0 } as HTMLAudioElement;
  applyMusicVolume(el, MUSIC_KEYS.BOSS_FORGE_GOLEM);
  expect(el.volume).toBe(0.5 * 1 * MUSIC_MASTER_GAIN * 2);
});

it("applies fade progress and the boss boost exactly once", () => {
  const el = { volume: 0 } as HTMLAudioElement;
  applyMusicVolume(el, MUSIC_KEYS.BOSS_FORGE_GOLEM, 0.25);
  expect(el.volume).toBe(0.5 * 1 * MUSIC_MASTER_GAIN * 0.25 * 2);
});

it("preserves currentTime on cached track when switching music", () => {
  class MockAudio {
    src = "";
    currentTime = 0;
    paused = true;
    volume = 1;
    muted = false;
    loop = false;
    constructor(src?: string) {
      this.src = src ?? "";
    }
    play() {
      this.paused = false;
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
    }
  }
  vi.stubGlobal("Audio", MockAudio);

  playMusicImmediate(MUSIC_KEYS.BATTLE);
  const battleElement = audioState.currentMusic;
  expect(battleElement).toBeDefined();
  if (battleElement) {
    battleElement.currentTime = 42;
  }

  // Switch to Menu music
  playMusicImmediate(MUSIC_KEYS.MENU);
  const menuElement = audioState.currentMusic;
  expect(menuElement).not.toBe(battleElement);
  expect(battleElement?.paused).toBe(true);
  expect(battleElement?.currentTime).toBe(42);

  // Switch back to Battle music — should resume the cached element without losing progress
  playMusicImmediate(MUSIC_KEYS.BATTLE);
  expect(audioState.currentMusic).toBe(battleElement);
  expect(battleElement?.currentTime).toBe(42);
});

it("resets currentTime to 0 on invalidateCacheForKey", () => {
  class MockAudio {
    src = "";
    currentTime = 0;
    paused = true;
    volume = 1;
    muted = false;
    loop = false;
    constructor(src?: string) {
      this.src = src ?? "";
    }
    play() {
      this.paused = false;
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
    }
  }
  vi.stubGlobal("Audio", MockAudio);

  playMusicImmediate(MUSIC_KEYS.BATTLE);
  const battleElement = audioState.currentMusic;
  if (battleElement) {
    battleElement.currentTime = 30;
  }

  invalidateCacheForKey(MUSIC_KEYS.BATTLE);
  expect(battleElement?.currentTime).toBe(0);
  expect(battleElement?.paused).toBe(true);
});

it("cancels prior transition when rapid playMusic is invoked", () => {
  vi.useFakeTimers();
  class MockAudio {
    src = "";
    currentTime = 0;
    paused = true;
    volume = 1;
    muted = false;
    loop = false;
    constructor(src?: string) {
      this.src = src ?? "";
    }
    play() {
      this.paused = false;
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
    }
  }
  vi.stubGlobal("Audio", MockAudio);

  playMusic(MUSIC_KEYS.MENU);
  const menuElement = audioState.currentMusic;
  expect(menuElement).toBeDefined();

  // Rapidly switch to Battle before Menu finishes fade-in
  playMusic(MUSIC_KEYS.BATTLE);
  expect(audioState.currentMusicKey).toBe(MUSIC_KEYS.BATTLE);

  // Advance time through fade-out and fade-in
  vi.advanceTimersByTime(3000);

  expect(audioState.currentMusic).toBeDefined();
  expect(audioState.currentMusicKey).toBe(MUSIC_KEYS.BATTLE);
  expect(menuElement?.paused).toBe(true);

  vi.useRealTimers();
});
