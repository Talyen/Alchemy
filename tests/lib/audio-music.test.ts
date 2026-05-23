import { describe, expect, it, beforeEach } from "vitest";
import { applyMusicVolume } from "@/lib/audio-music";
import { audioState } from "@/lib/audio-state";
import { MUSIC_MASTER_GAIN } from "@/lib/game-constants";

beforeEach(() => {
  audioState.musicVolume = 0.5;
  audioState.masterVolume = 1;
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
