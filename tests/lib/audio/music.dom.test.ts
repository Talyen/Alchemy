import { expect, it, beforeEach, vi, afterEach } from "vitest";
import {
  computeMusicVolume,
  endBossPreview,
  getBossMusicKey,
  invalidateCacheForKey,
  isMusicPaused,
  pauseAllMusic,
  playMusic,
  playMusicImmediate,
  previewBossMusic,
  resetMusicRuntimeForTests,
} from "@/lib/audio/music";
import { audioState } from "@/lib/audio/state";
import { MUSIC_KEYS, MUSIC_MASTER_GAIN } from "@/lib/game-constants";
import { createdFakeAudio, lastFakeAudio, installFakeAudio } from "../../helpers/fake-audio";
import { installCleanAudio } from "../../helpers/audio-fixture";

beforeEach(() => {
  installCleanAudio();
  audioState.musicVolume = 0.5;
  audioState.masterVolume = 1;
  vi.useFakeTimers();
});

afterEach(() => {
  resetMusicRuntimeForTests();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("keeps the volume curve, fade gain, boss boost, and saturation", () => {
  expect(computeMusicVolume({ musicVolume: 0.5, masterVolume: 0.5 })).toBe(0.25 * MUSIC_MASTER_GAIN);
  expect(computeMusicVolume({ musicVolume: 1, masterVolume: 1, isBoss: true })).toBe(1);
  expect(computeMusicVolume({ musicVolume: 0.5, masterVolume: 1, isBoss: true })).toBe(MUSIC_MASTER_GAIN);
  expect(computeMusicVolume({ musicVolume: 0.5, masterVolume: 1, fadeGain: 0.25, isBoss: true })).toBe(
    0.25 * MUSIC_MASTER_GAIN,
  );
  expect(computeMusicVolume({ musicVolume: 0, masterVolume: 1 })).toBe(0);
});

it("resolves boss tracks and skips the Iron Bear intro", () => {
  expect(getBossMusicKey("forge-golem")).toBe(MUSIC_KEYS.BOSS_FORGE_GOLEM);
  expect(getBossMusicKey("frostwarden")).toBe(MUSIC_KEYS.BOSS_FROSTWARDEN);
  expect(getBossMusicKey("blight-treant")).toBe(MUSIC_KEYS.BOSS_BLIGHT_TREANT);
  expect(getBossMusicKey("iron-bear")).toBe(MUSIC_KEYS.BOSS_IRON_BEAR);
  expect(getBossMusicKey("unknown-boss")).toBeUndefined();
  playMusicImmediate(MUSIC_KEYS.BOSS_IRON_BEAR);
  expect(lastFakeAudio()).toMatchObject({ currentTime: 6, loop: true, paused: false });
});

it("caches tracks and preserves seek positions across switches", () => {
  playMusicImmediate(MUSIC_KEYS.BATTLE);
  const battle = lastFakeAudio()!;
  battle.currentTime = 42;
  playMusicImmediate(MUSIC_KEYS.MENU);
  const menu = lastFakeAudio()!;
  expect(battle.paused).toBe(true);
  playMusicImmediate(MUSIC_KEYS.BATTLE);
  expect(battle).toMatchObject({ currentTime: 42, paused: false });
  expect(menu.paused).toBe(true);
  expect(createdFakeAudio).toHaveLength(2);
});

it("resumes the same paused element without replacing it", () => {
  expect(isMusicPaused()).toBe(true);
  playMusicImmediate(MUSIC_KEYS.MENU);
  const menu = lastFakeAudio()!;
  expect(isMusicPaused()).toBe(false);
  menu.pause();
  expect(isMusicPaused()).toBe(true);
  playMusic(MUSIC_KEYS.MENU);
  expect(menu.paused).toBe(false);
  expect(createdFakeAudio).toHaveLength(1);
  expect(vi.getTimerCount()).toBe(0);
});

it("fades out before starting the delayed incoming fade", () => {
  playMusicImmediate(MUSIC_KEYS.MENU);
  const menu = lastFakeAudio()!;
  playMusic(MUSIC_KEYS.BATTLE);
  vi.advanceTimersByTime(150);
  expect(menu.volume).toBeCloseTo(0.25 * MUSIC_MASTER_GAIN);
  expect(createdFakeAudio).toHaveLength(1);
  vi.advanceTimersByTime(150);
  const battle = lastFakeAudio()!;
  expect(battle.src).toContain("Music/Battle");
  expect(menu.paused).toBe(true);
  expect(battle).toMatchObject({ volume: 0, paused: false });
  vi.advanceTimersByTime(600);
  expect(battle.volume).toBe(0);
  vi.advanceTimersByTime(1500);
  expect(battle.volume).toBeCloseTo(0.5 * MUSIC_MASTER_GAIN);
  expect(vi.getTimerCount()).toBe(0);
});

it("replaces an interrupted destination without resetting the outgoing gain", () => {
  playMusicImmediate(MUSIC_KEYS.MENU);
  const menu = lastFakeAudio()!;
  playMusic(MUSIC_KEYS.BATTLE);
  vi.advanceTimersByTime(150);
  const interruptedVolume = menu.volume;
  playMusic(MUSIC_KEYS.BOSS_FORGE_GOLEM);
  vi.advanceTimersByTime(30);
  expect(menu.volume).toBeLessThan(interruptedVolume);
  expect(vi.getTimerCount()).toBe(1);
  vi.advanceTimersByTime(3000);
  expect(lastFakeAudio()?.src).toContain("The Forge Golem.mp3");
  expect(createdFakeAudio).toHaveLength(2);
  expect(menu.paused).toBe(true);
});

it("dedupes a pending destination and lets an immediate switch cancel it", () => {
  playMusicImmediate(MUSIC_KEYS.MENU);
  playMusic(MUSIC_KEYS.BATTLE);
  vi.advanceTimersByTime(150);
  playMusic(MUSIC_KEYS.BATTLE);
  vi.advanceTimersByTime(150);
  expect(lastFakeAudio()?.src).toContain("Music/Battle");
  playMusicImmediate(MUSIC_KEYS.BOSS_FROSTWARDEN);
  expect(vi.getTimerCount()).toBe(0);
  vi.advanceTimersByTime(3000);
  expect(lastFakeAudio()?.src).toContain("The Frostwarden.mp3");
});

it("pauses during a switch and can then select the abandoned destination", () => {
  playMusicImmediate(MUSIC_KEYS.MENU);
  const menu = lastFakeAudio()!;
  playMusic(MUSIC_KEYS.BATTLE);
  vi.advanceTimersByTime(150);
  pauseAllMusic();
  vi.advanceTimersByTime(3000);
  expect(menu).toMatchObject({ paused: true, muted: true });
  expect(createdFakeAudio).toHaveLength(1);
  playMusic(MUSIC_KEYS.BATTLE);
  vi.advanceTimersByTime(3000);
  expect(lastFakeAudio()?.src).toContain("Music/Battle");
  expect(lastFakeAudio()).toMatchObject({ paused: false, muted: false, volume: 0.5 * MUSIC_MASTER_GAIN });
});

it("resumes a cancelled fade-in at audible gain and clears the forced pause mute", () => {
  playMusic(MUSIC_KEYS.MENU);
  const menu = lastFakeAudio()!;
  pauseAllMusic();
  playMusic(MUSIC_KEYS.MENU);
  expect(menu).toMatchObject({ paused: false, muted: false, volume: 0.5 * MUSIC_MASTER_GAIN });
  expect(vi.getTimerCount()).toBe(0);
});

it("invalidating the pending destination cancels its timer and preserves outgoing playback", () => {
  playMusicImmediate(MUSIC_KEYS.MENU);
  const menu = lastFakeAudio()!;
  playMusic(MUSIC_KEYS.BATTLE);
  vi.advanceTimersByTime(150);
  invalidateCacheForKey(MUSIC_KEYS.BATTLE);
  vi.advanceTimersByTime(3000);
  expect(createdFakeAudio).toHaveLength(1);
  expect(menu).toMatchObject({ paused: false, volume: 0.5 * MUSIC_MASTER_GAIN });
  expect(vi.getTimerCount()).toBe(0);
});

it("invalidating the outgoing track stops the transition and builds a fresh track on replay", () => {
  playMusicImmediate(MUSIC_KEYS.MENU);
  const menu = lastFakeAudio()!;
  menu.currentTime = 42;
  playMusic(MUSIC_KEYS.BATTLE);
  invalidateCacheForKey(MUSIC_KEYS.MENU);
  vi.advanceTimersByTime(3000);
  expect(menu).toMatchObject({ paused: true, currentTime: 0 });
  expect(isMusicPaused()).toBe(true);
  expect(createdFakeAudio).toHaveLength(1);
  playMusicImmediate(MUSIC_KEYS.MENU);
  expect(lastFakeAudio()).not.toBe(menu);
  expect(lastFakeAudio()?.paused).toBe(false);
});

it("invalidating an unrelated key preserves an incoming fade", () => {
  playMusic(MUSIC_KEYS.MENU);
  invalidateCacheForKey(MUSIC_KEYS.BATTLE);
  vi.advanceTimersByTime(3000);
  expect(lastFakeAudio()).toMatchObject({ paused: false, volume: 0.5 * MUSIC_MASTER_GAIN });
});

it("reset cancels callbacks and drops cached boss elements", () => {
  playMusic(MUSIC_KEYS.BOSS_FROSTWARDEN);
  const boss = lastFakeAudio()!;
  resetMusicRuntimeForTests();
  expect(vi.getTimerCount()).toBe(0);
  expect(isMusicPaused()).toBe(true);
  playMusicImmediate(MUSIC_KEYS.BOSS_FROSTWARDEN);
  expect(lastFakeAudio()).not.toBe(boss);
  expect(boss.paused).toBe(true);
});

it("dedupes previews, ignores unknown requests, and restores menu on preview end", () => {
  previewBossMusic(MUSIC_KEYS.BOSS_FORGE_GOLEM);
  previewBossMusic(MUSIC_KEYS.BOSS_FORGE_GOLEM);
  expect(createdFakeAudio).toHaveLength(1);
  playMusic("unknown-key");
  playMusicImmediate("unknown-key");
  endBossPreview();
  vi.advanceTimersByTime(3000);
  expect(lastFakeAudio()?.src).toContain("Music/Menu");
  expect(createdFakeAudio).toHaveLength(2);
});

it("screen selection and pause end preview ownership", () => {
  previewBossMusic(MUSIC_KEYS.BOSS_FORGE_GOLEM);
  playMusicImmediate(MUSIC_KEYS.BATTLE);
  endBossPreview();
  vi.advanceTimersByTime(3000);
  expect(lastFakeAudio()?.src).toContain("Music/Battle");
  previewBossMusic(MUSIC_KEYS.BOSS_FROSTWARDEN);
  pauseAllMusic();
  endBossPreview();
  vi.advanceTimersByTime(3000);
  expect(isMusicPaused()).toBe(true);
  expect(createdFakeAudio).toHaveLength(2);
});

it("does not play in a non-player host", () => {
  vi.stubGlobal("navigator", { ...navigator, userAgent: "Mozilla/5.0 Electron/28.0.0" });
  playMusicImmediate(MUSIC_KEYS.MENU);
  expect(lastFakeAudio()?.play).not.toHaveBeenCalled();
  expect(lastFakeAudio()).toMatchObject({ paused: true, muted: true });
});

it("warns when playback stays blocked", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  installFakeAudio({ rejectPlay: true });
  playMusicImmediate(MUSIC_KEYS.MENU);
  await Promise.resolve();
  expect(warn).toHaveBeenCalledWith("Music playback blocked until user interaction");
  warn.mockRestore();
});
