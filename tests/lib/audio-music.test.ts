import { expect, it, beforeEach, vi, afterEach } from "vitest";
import {
  applyMusicVolume,
  getBossMusicKey,
  invalidateCacheForKey,
  isMusicPaused,
  pauseAllMusic,
  playMusic,
  playMusicImmediate,
} from "@/lib/audio-music";
import { audioState } from "@/lib/audio-state";
import { MUSIC_KEYS, MUSIC_MASTER_GAIN } from "@/lib/game-constants";
import { installFakeAudio, resetMusicState, type FakeAudioElement } from "../helpers/fake-audio";

beforeEach(() => {
  audioState.musicVolume = 0.5;
  audioState.masterVolume = 1;
  resetMusicState();
  installFakeAudio();
  invalidateCacheForKey(MUSIC_KEYS.MENU);
  invalidateCacheForKey(MUSIC_KEYS.BATTLE);
  invalidateCacheForKey(MUSIC_KEYS.BOSS_FORGE_GOLEM);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
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

it("resolves each boss id to its music key", () => {
  expect(getBossMusicKey("forge-golem")).toBe(MUSIC_KEYS.BOSS_FORGE_GOLEM);
  expect(getBossMusicKey("frostwarden")).toBe(MUSIC_KEYS.BOSS_FROSTWARDEN);
  expect(getBossMusicKey("blight-treant")).toBe(MUSIC_KEYS.BOSS_BLIGHT_TREANT);
  expect(getBossMusicKey("iron-bear")).toBe(MUSIC_KEYS.BOSS_IRON_BEAR);
  expect(getBossMusicKey("unknown-boss")).toBeUndefined();
});

it("loops a newly started track", () => {
  playMusicImmediate(MUSIC_KEYS.BATTLE);
  expect(audioState.currentMusic?.loop).toBe(true);
  expect(audioState.currentMusic?.src).toContain("Music/Battle");
});

it("skips the iron bear intro", () => {
  playMusicImmediate(MUSIC_KEYS.BOSS_IRON_BEAR);
  expect(audioState.currentMusic?.currentTime).toBe(6);
  invalidateCacheForKey(MUSIC_KEYS.BOSS_IRON_BEAR);
});

it("reports pause state from the current element", () => {
  expect(isMusicPaused()).toBe(true);
  playMusicImmediate(MUSIC_KEYS.MENU);
  expect(isMusicPaused()).toBe(false);
  audioState.currentMusic?.pause();
  expect(isMusicPaused()).toBe(true);
});

it("pauses and mutes every cached track", () => {
  playMusicImmediate(MUSIC_KEYS.MENU);
  playMusicImmediate(MUSIC_KEYS.BATTLE);
  pauseAllMusic();
  expect(audioState.currentMusic?.paused).toBe(true);
  expect(audioState.currentMusic?.muted).toBe(true);
});

it("warns when playback stays blocked", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  installFakeAudio({ rejectPlay: true });
  playMusicImmediate(MUSIC_KEYS.MENU);
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
  expect(warn).toHaveBeenCalledWith("Music playback blocked until user interaction");
  warn.mockRestore();
});

it("resumes the same key without a transition", () => {
  playMusicImmediate(MUSIC_KEYS.MENU);
  const el = audioState.currentMusic as unknown as FakeAudioElement;
  el.pause();
  const plays = el.play.mock.calls.length;
  playMusic(MUSIC_KEYS.MENU);
  expect(el.play.mock.calls.length).toBe(plays + 1);
  expect(audioState.currentMusic).toBe(el as unknown as HTMLAudioElement);
});

it("preserves currentTime on cached track when switching music", () => {
  playMusicImmediate(MUSIC_KEYS.BATTLE);
  const battleElement = audioState.currentMusic;
  expect(battleElement).toBeDefined();
  if (battleElement) {
    battleElement.currentTime = 42;
  }

  playMusicImmediate(MUSIC_KEYS.MENU);
  const menuElement = audioState.currentMusic;
  expect(menuElement).not.toBe(battleElement);
  expect(battleElement?.paused).toBe(true);
  expect(battleElement?.currentTime).toBe(42);

  playMusicImmediate(MUSIC_KEYS.BATTLE);
  expect(audioState.currentMusic).toBe(battleElement);
  expect(battleElement?.currentTime).toBe(42);
});

it("resets currentTime to 0 on invalidateCacheForKey", () => {
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

  playMusic(MUSIC_KEYS.MENU);
  const menuElement = audioState.currentMusic;
  expect(menuElement).toBeDefined();

  playMusic(MUSIC_KEYS.BATTLE);
  expect(audioState.currentMusicKey).toBe(MUSIC_KEYS.BATTLE);
  expect(vi.getTimerCount()).toBe(1);

  playMusicImmediate(MUSIC_KEYS.BATTLE);
  expect(vi.getTimerCount()).toBe(0);

  playMusic(MUSIC_KEYS.MENU);

  vi.advanceTimersByTime(3000);

  expect(audioState.currentMusic).toBeDefined();
  expect(audioState.currentMusicKey).toBe(MUSIC_KEYS.MENU);
  expect(audioState.currentMusic).toBe(menuElement);
  expect(menuElement?.paused).toBe(false);
});

it("continues fading from the current gain when a transition is interrupted", () => {
  vi.useFakeTimers();

  playMusicImmediate(MUSIC_KEYS.MENU);
  const outgoing = audioState.currentMusic;
  playMusic(MUSIC_KEYS.BATTLE);
  vi.advanceTimersByTime(150);
  const interruptedVolume = outgoing?.volume ?? 0;

  playMusic(MUSIC_KEYS.BOSS_FORGE_GOLEM);
  vi.advanceTimersByTime(30);

  expect(outgoing?.volume).toBeLessThanOrEqual(interruptedVolume);

  playMusicImmediate(MUSIC_KEYS.MENU);
});

it("does not start playback in a non-player host", () => {
  vi.stubGlobal("navigator", { ...navigator, userAgent: "Mozilla/5.0 Electron/28.0.0" });

  playMusicImmediate(MUSIC_KEYS.MENU);
  const el = audioState.currentMusic as unknown as FakeAudioElement | null;
  expect(el?.play).not.toHaveBeenCalled();
  expect(audioState.currentMusic?.paused).toBe(true);
  expect(audioState.currentMusic?.muted).toBe(true);
});
