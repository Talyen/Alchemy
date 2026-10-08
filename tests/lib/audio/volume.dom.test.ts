import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { initAudioHost, setMuted, setSfxVolume, setMasterVolume, setMusicVolume } from "@/lib/audio/volume";
import { audioState } from "@/lib/audio/state";
import { MUSIC_KEYS, MUSIC_MASTER_GAIN } from "@/lib/game-constants";
import { playMusic, playMusicImmediate } from "@/lib/audio/music";
import { setScreenAmbience } from "@/lib/audio/ambience";
import { playBattleEvent } from "@/lib/audio/sfx";
import { SFX_AMBIENCE_VOLUME } from "@/lib/game-constants";
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
    setMuted(false);
    expect(audioState.muted).toBe(true);
    expect(el.muted).toBe(true);
    expect(el.pause).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("can unmute and play feedback after an initially undisplayed window becomes visible", () => {
    const outerWidth = Object.getOwnPropertyDescriptor(window, "outerWidth")!;
    try {
      Object.defineProperty(window, "outerWidth", { configurable: true, value: 0 });
      playMusicImmediate(MUSIC_KEYS.MENU);
      const music = lastFakeAudio()!;
      initAudioHost();
      setMuted(false);
      expect(audioState.muted).toBe(true);
      Object.defineProperty(window, "outerWidth", outerWidth);
      setMuted(false);
      expect(audioState.muted).toBe(false);
      expect(music.muted).toBe(false);
      playBattleEvent("playerHeal");
      expect(lastFakeAudio()!.play).toHaveBeenCalledOnce();
    } finally {
      Object.defineProperty(window, "outerWidth", outerWidth);
    }
  });
});

describe("setMasterVolume", () => {
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

it("applies channel limits to live music, sound effects and ambience independently", () => {
  playMusicImmediate(MUSIC_KEYS.BOSS_FORGE_GOLEM);
  const music = lastFakeAudio()!;
  playBattleEvent("playerHeal", { volume: 0.5 });
  const sfx = lastFakeAudio()!;
  setScreenAmbience("campfire");
  const ambience = lastFakeAudio()!;
  setMasterVolume(0.5);
  setSfxVolume(2);
  setMusicVolume(0.25);
  expect(music.volume).toBeCloseTo(0.25 * 0.5 * MUSIC_MASTER_GAIN * 2);
  expect(sfx.volume).toBeCloseTo(0.5 * 0.5);
  expect(ambience.volume).toBeCloseTo(SFX_AMBIENCE_VOLUME * 0.5);
  setSfxVolume(-1);
  expect(sfx.volume).toBe(0);
  expect(ambience.volume).toBe(0);
  expect(music.volume).toBeCloseTo(0.25 * 0.5 * MUSIC_MASTER_GAIN * 2);
});
