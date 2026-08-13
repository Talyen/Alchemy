import { expect, it, beforeEach } from "vitest";
import { applyMusicVolume } from "@/lib/audio-music";
import { audioState } from "@/lib/audio-state";
import { MUSIC_KEYS, MUSIC_MASTER_GAIN } from "@/lib/game-constants";

beforeEach(() => {
  audioState.musicVolume = 0.5;
  audioState.masterVolume = 1;
  audioState.currentMusicKey = null;
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
