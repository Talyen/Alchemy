import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { playMusic, playMusicImmediate, previewBossMusic, resetMusicRuntimeForTests } from "@/lib/audio/music";
import { MUSIC_KEYS } from "@/lib/game-constants";
import { installCleanAudio } from "../../helpers/audio-fixture";
import { lastFakeAudio } from "../../helpers/fake-audio";

beforeEach(() => {
  installCleanAudio();
  vi.useFakeTimers();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  resetMusicRuntimeForTests();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("returning to a blocked track during fade-out retries playback", async () => {
  installCleanAudio({ rejectPlay: true });
  playMusicImmediate(MUSIC_KEYS.MENU);
  const menu = lastFakeAudio()!;
  await Promise.resolve();
  menu.play.mockImplementation(() => {
    menu.paused = false;
    return Promise.resolve();
  });
  playMusic(MUSIC_KEYS.BATTLE);
  playMusic(MUSIC_KEYS.MENU);
  expect(menu.paused).toBe(false);
});

it("a second boss-preview click retries a blocked preview", async () => {
  installCleanAudio({ rejectPlay: true });
  previewBossMusic(MUSIC_KEYS.BOSS_FORGE_GOLEM);
  const boss = lastFakeAudio()!;
  await Promise.resolve();
  boss.play.mockImplementation(() => {
    boss.paused = false;
    return Promise.resolve();
  });
  previewBossMusic(MUSIC_KEYS.BOSS_FORGE_GOLEM);
  expect(boss.paused).toBe(false);
});
