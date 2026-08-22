import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { audioState } from "@/lib/audio-state";
import { playBattleEvent, playUISound, playVictory, resetHtmlSfxRuntime } from "@/lib/audio-sfx";
import { uiSounds } from "@/lib/sound-registry";

describe("SFX playback from a cold audio runtime", () => {
  const playedSrcs: string[] = [];

  beforeEach(() => {
    playedSrcs.length = 0;
    audioState.muted = false;
    audioState.sfxVolume = 0.5;
    audioState.masterVolume = 1;
    audioState.lastPlayedAt = new Map();
    resetHtmlSfxRuntime();
    vi.stubGlobal(
      "Audio",
      class {
        volume = 1;
        muted = false;
        src = "";
        onended: (() => void) | null = null;
        constructor(src?: string) {
          this.src = src ?? "";
        }
        currentTime = 0;
        pause = () => {};
        play = () => {
          playedSrcs.push(this.src);
          return Promise.resolve();
        };
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not no-op UI, combat, or victory SFX from a cold runtime", () => {
    playUISound("error");
    playBattleEvent("enemyHit");
    playVictory();

    expect(playedSrcs).toHaveLength(3);
    expect(playedSrcs.some((src) => src.includes("denied-03."))).toBe(true);
    expect(playedSrcs.some((src) => src.includes("sword-impact-hit-1."))).toBe(true);
    expect(playedSrcs.some((src) => src.includes("harpsichord-level-complete."))).toBe(true);
  });

  it("does not play when muted", () => {
    audioState.muted = true;
    playUISound("error");
    expect(playedSrcs).toEqual([]);
  });

  it("resolves UI cues from the registry", () => {
    expect(uiSounds.error).toMatch(/denied-03\.(ogg|mp3)$/);
  });
});
