import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { initAudioHost, setMuted, setSfxVolume, setMasterVolume, setMusicVolume } from "@/lib/audio/volume";
import { audioState } from "@/lib/audio/state";
import { MUSIC_KEYS, MUSIC_MASTER_GAIN } from "@/lib/game-constants";
import { playMusic, playMusicImmediate } from "@/lib/audio/music";
import { lastFakeAudio } from "../../helpers/fake-audio";
import { installCleanAudio } from "../../helpers/audio-fixture";

beforeEach(() => {
  installCleanAudio();
  audioState.sfxVolume = 0.35;
  audioState.masterVolume = 1;
  audioState.musicVolume = 0.0875;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("setMuted", () => {
  it("sets muted on audioState", () => {
    setMuted(true);
    expect(audioState.muted).toBe(true);
  });

  it("mutes the current music element", () => {
    playMusicImmediate(MUSIC_KEYS.MENU);
    const el = lastFakeAudio()!;
    setMuted(true);
    expect(el.muted).toBe(true);
  });

  it("unmutes the current music element on a player host", () => {
    playMusicImmediate(MUSIC_KEYS.MENU);
    const el = lastFakeAudio()!;
    setMuted(true);
    expect(el.muted).toBe(true);
    setMuted(false);
    expect(audioState.muted).toBe(false);
    expect(el.muted).toBe(false);
  });

  it("keeps a non-player host muted when unmute is requested", () => {
    vi.stubGlobal("navigator", { ...navigator, userAgent: "Mozilla/5.0 Electron/28.0.0" });
    playMusicImmediate(MUSIC_KEYS.MENU);
    const el = lastFakeAudio()!;
    initAudioHost();
    expect(audioState.hostForcesMute).toBe(true);
    setMuted(false);
    expect(audioState.muted).toBe(true);
    expect(el.muted).toBe(true);
    expect(el.pause).toHaveBeenCalled();
    vi.unstubAllGlobals();
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
    playMusicImmediate(MUSIC_KEYS.MENU);
    const el = lastFakeAudio()!;
    audioState.musicVolume = 0.5;
    setMasterVolume(0.5);
    expect(el.volume).toBe(0.5 * 0.5 * MUSIC_MASTER_GAIN);
  });

  it("preserves the boss volume boost", () => {
    playMusicImmediate(MUSIC_KEYS.BOSS_FORGE_GOLEM);
    const el = lastFakeAudio()!;
    audioState.musicVolume = 0.5;
    setMasterVolume(0.5);
    expect(el.volume).toBe(0.5 * 0.5 * MUSIC_MASTER_GAIN * 2);
  });

  it("preserves the outgoing fade gain when master volume changes during a crossfade", () => {
    vi.useFakeTimers();

    playMusicImmediate(MUSIC_KEYS.MENU);
    const outgoing = lastFakeAudio();
    playMusic(MUSIC_KEYS.BOSS_FORGE_GOLEM);
    vi.advanceTimersByTime(150);
    const fadedVolume = outgoing?.volume ?? 0;
    setMasterVolume(0.5);

    expect(outgoing?.volume).toBeCloseTo(fadedVolume * 0.5);

    playMusicImmediate(MUSIC_KEYS.MENU);
  });
});

describe("setMusicVolume", () => {
  it("sets musicVolume", () => {
    setMusicVolume(0.2);
    expect(audioState.musicVolume).toBe(0.2);
  });

  it("updates current music element volume", () => {
    playMusicImmediate(MUSIC_KEYS.MENU);
    const el = lastFakeAudio()!;
    audioState.masterVolume = 0.5;
    audioState.musicVolume = 0.5;
    setMusicVolume(0.5);
    expect(el.volume).toBe(0.5 * 0.5 * MUSIC_MASTER_GAIN);
  });

  it("preserves the boss volume boost", () => {
    playMusicImmediate(MUSIC_KEYS.BOSS_FORGE_GOLEM);
    const el = lastFakeAudio()!;
    audioState.masterVolume = 0.5;
    setMusicVolume(0.5);
    expect(el.volume).toBe(0.5 * 0.5 * MUSIC_MASTER_GAIN * 2);
  });

  it("preserves the incoming fade gain when music volume changes", () => {
    vi.useFakeTimers();

    playMusic(MUSIC_KEYS.MENU);
    vi.advanceTimersByTime(900);
    const incoming = lastFakeAudio();
    const fadedVolume = incoming?.volume ?? 0;
    setMusicVolume(audioState.musicVolume * 0.5);

    expect(incoming?.volume).toBeCloseTo(fadedVolume * 0.5);

    playMusicImmediate(MUSIC_KEYS.MENU);
  });
});
