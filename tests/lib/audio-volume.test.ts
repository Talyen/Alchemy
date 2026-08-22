import { describe, expect, it, beforeEach, vi } from "vitest";
import { setMuted, setSfxVolume, setMasterVolume, setMusicVolume } from "@/lib/audio-volume";
import { audioState } from "@/lib/audio-state";
import { MUSIC_KEYS, MUSIC_MASTER_GAIN } from "@/lib/game-constants";
import { invalidateCacheForKey, playMusic, playMusicImmediate } from "@/lib/audio-music";

beforeEach(() => {
  audioState.muted = false;
  audioState.sfxVolume = 0.35;
  audioState.masterVolume = 1;
  audioState.musicVolume = 0.0875;
  audioState.currentMusic = null;
  audioState.currentMusicKey = null;
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
  it("sets masterVolume on audioState", () => {
    setMasterVolume(0.5);
    expect(audioState.masterVolume).toBe(0.5);
  });

  it("updates current music volume", () => {
    const el = { volume: 0 } as Partial<HTMLAudioElement>;
    audioState.currentMusic = el as HTMLAudioElement;
    audioState.musicVolume = 0.5;
    setMasterVolume(0.5);
    expect(el.volume).toBe(0.5 * 0.5 * MUSIC_MASTER_GAIN);
  });

  it("preserves the boss volume boost", () => {
    const el = { volume: 0 } as Partial<HTMLAudioElement>;
    audioState.currentMusic = el as HTMLAudioElement;
    audioState.currentMusicKey = MUSIC_KEYS.BOSS_FORGE_GOLEM;
    audioState.musicVolume = 0.5;
    setMasterVolume(0.5);
    expect(el.volume).toBe(0.5 * 0.5 * MUSIC_MASTER_GAIN * 2);
  });

  it("uses the outgoing element's key when volume changes during a crossfade", () => {
    vi.useFakeTimers();
    class MockAudio {
      currentTime = 0;
      loop = false;
      muted = false;
      paused = true;
      volume = 0;

      constructor(public readonly src: string) {}

      pause() {
        this.paused = true;
      }

      play() {
        this.paused = false;
        return Promise.resolve();
      }
    }
    vi.stubGlobal("Audio", MockAudio);

    playMusicImmediate(MUSIC_KEYS.MENU);
    const outgoing = audioState.currentMusic;
    playMusic(MUSIC_KEYS.BOSS_FORGE_GOLEM);
    setMasterVolume(0.5);

    expect(outgoing?.volume).toBe(audioState.musicVolume * 0.5 * MUSIC_MASTER_GAIN);

    playMusicImmediate(MUSIC_KEYS.MENU);
    vi.advanceTimersByTime(31);
    invalidateCacheForKey(MUSIC_KEYS.MENU);
    invalidateCacheForKey(MUSIC_KEYS.BOSS_FORGE_GOLEM);
    vi.unstubAllGlobals();
    vi.useRealTimers();
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
    audioState.currentMusic = el as HTMLAudioElement;
    setMusicVolume(0.5);
    expect(el.volume).toBe(0.5 * 0.5 * MUSIC_MASTER_GAIN);
  });

  it("preserves the boss volume boost", () => {
    const el = { volume: 0 } as Partial<HTMLAudioElement>;
    audioState.currentMusic = el as HTMLAudioElement;
    audioState.currentMusicKey = MUSIC_KEYS.BOSS_FORGE_GOLEM;
    audioState.masterVolume = 0.5;
    setMusicVolume(0.5);
    expect(el.volume).toBe(0.5 * 0.5 * MUSIC_MASTER_GAIN * 2);
  });
});
