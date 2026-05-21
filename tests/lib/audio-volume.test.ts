import { describe, expect, it, beforeEach } from "vitest";
import { setMuted, setSfxVolume, setMasterVolume, setMusicVolume } from "@/lib/audio-volume";
import { audioState } from "@/lib/audio-state";
import { MUSIC_MASTER_GAIN } from "@/lib/game-constants";

beforeEach(() => {
  audioState.muted = false;
  audioState.sfxVolume = 0.35;
  audioState.masterVolume = 1;
  audioState.musicVolume = 0.0875;
  audioState.currentMusic = null;
  audioState.masterGain = null;
});

describe("setMuted", () => {
  it("sets muted on audioState", () => {
    setMuted(true);
    expect(audioState.muted).toBe(true);
  });

  it("mutes the current music element", () => {
    const el = { muted: false } as Partial<HTMLAudioElement>;
    audioState.currentMusic = el as HTMLAudioElement;
    setMuted(true);
    expect(el.muted).toBe(true);
  });

  it("silences and restores the Web Audio master gain", () => {
    const gain = { value: 0.3 };
    audioState.masterGain = { gain } as unknown as GainNode;
    audioState.masterVolume = 0.5;
    setMuted(true);
    expect(gain.value).toBe(0);
    setMuted(false);
    expect(gain.value).toBe(0.3 * 0.5);
  });
});

describe("setSfxVolume", () => {
  it("sets sfxVolume within bounds", () => {
    setSfxVolume(0.5);
    expect(audioState.sfxVolume).toBe(0.5);
  });

  it("clamps above max", () => {
    setSfxVolume(1.5);
    expect(audioState.sfxVolume).toBe(1);
  });

  it("clamps below min", () => {
    setSfxVolume(-0.5);
    expect(audioState.sfxVolume).toBe(0);
  });
});

describe("setMasterVolume", () => {
  it("sets masterVolume and updates masterGain", () => {
    const gain = { value: 0 };
    audioState.masterGain = { gain } as unknown as GainNode;
    setMasterVolume(0.5);
    expect(audioState.masterVolume).toBe(0.5);
    expect(gain.value).toBe(0.3 * 0.5); // MASTER_GAIN * masterVolume
  });

  it("keeps masterGain silent while muted", () => {
    const gain = { value: 0.3 };
    audioState.masterGain = { gain } as unknown as GainNode;
    audioState.muted = true;
    setMasterVolume(0.5);
    expect(gain.value).toBe(0);
  });

  it("updates current music volume", () => {
    const el = { volume: 0 } as Partial<HTMLAudioElement>;
    audioState.currentMusic = el as HTMLAudioElement;
    audioState.musicVolume = 0.5;
    setMasterVolume(0.5);
    expect(el.volume).toBe(0.5 * 0.5 * MUSIC_MASTER_GAIN);
  });
});

describe("setMusicVolume", () => {
  it("sets musicVolume", () => {
    setMusicVolume(0.2);
    expect(audioState.musicVolume).toBe(0.2);
  });

  it("updates current music element volume", () => {
    const el = { volume: 0 } as Partial<HTMLAudioElement>;
    audioState.currentMusic = el as HTMLAudioElement;
    audioState.masterVolume = 0.5;
    audioState.musicVolume = 0.5;
    audioState.currentMusic = el;
    setMusicVolume(0.5);
    expect(el.volume).toBe(0.5 * 0.5 * MUSIC_MASTER_GAIN);
  });
});
