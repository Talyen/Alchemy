import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { playMusic, playMusicImmediate, resetMusicRuntimeForTests } from "@/lib/audio/music";
import { audioState } from "@/lib/audio/state";
import { MUSIC_KEYS, MUSIC_MASTER_GAIN } from "@/lib/game-constants";
import { installCleanAudio } from "../../helpers/audio-fixture";
import { lastFakeAudio } from "../../helpers/fake-audio";

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

it("keeps the current music audible when the incoming track cannot initialize", () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  playMusicImmediate(MUSIC_KEYS.MENU);
  const menu = lastFakeAudio()!;
  const workingAudio = Audio;
  vi.stubGlobal(
    "Audio",
    class {
      constructor() {
        throw new Error("Track initialization failed");
      }
    },
  );
  playMusic(MUSIC_KEYS.BATTLE);
  vi.advanceTimersByTime(400);
  expect(menu.paused).toBe(false);
  expect(menu.volume).toBe(0.5 * MUSIC_MASTER_GAIN);
  playMusic(MUSIC_KEYS.MENU);
  expect(menu.volume).toBe(0.5 * MUSIC_MASTER_GAIN);
  vi.stubGlobal("Audio", workingAudio);
  playMusic(MUSIC_KEYS.BATTLE);
  vi.advanceTimersByTime(3000);
  expect(lastFakeAudio()?.src).toContain("Music/Battle");
  expect(lastFakeAudio()?.volume).toBeCloseTo(0.5 * MUSIC_MASTER_GAIN);
});
