import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { audioState } from "@/lib/audio-state";
import { uiSounds } from "@/lib/sound-registry";
import {
  stopAllSfx,
  playCardSound,
  playGoldGain,
  playGoldSpend,
  playEnemyAttack,
  playBattleEvent,
  playUISound,
  playVictory,
  playDefeat,
  playSliceDeath,
  resetHtmlSfxRuntime,
} from "@/lib/audio-sfx";
import { setMasterVolume, setMuted, setSfxVolume } from "@/lib/audio-volume";

interface FakeAudio {
  src: string;
  volume: number;
  muted: boolean;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  removeAttribute: ReturnType<typeof vi.fn>;
  load: ReturnType<typeof vi.fn>;
  onended: (() => void) | null;
}

const created: FakeAudio[] = [];

function lastAudio() {
  return created.at(-1);
}

beforeEach(() => {
  created.length = 0;
  audioState.muted = false;
  audioState.sfxVolume = 0.35;
  audioState.masterVolume = 1;
  audioState.lastPlayedAt = new Map();
  resetHtmlSfxRuntime();
  vi.stubGlobal(
    "Audio",
    class {
      src = "";
      volume = 1;
      muted = false;
      onended: (() => void) | null = null;
      play = vi.fn(() => Promise.resolve());
      pause = vi.fn();
      removeAttribute = vi.fn();
      load = vi.fn();
      currentTime = 0;
      constructor(src?: string) {
        this.src = src ?? "";
        created.push(this);
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("stopAllSfx", () => {
  it("runs without error when no active sources", () => {
    expect(() => stopAllSfx()).not.toThrow();
  });

  it("stops battle-tracked sources", () => {
    playCardSound("slash");
    const el = lastAudio()!;
    stopAllSfx();
    expect(el.pause).toHaveBeenCalledOnce();
    expect(el.removeAttribute).toHaveBeenCalledWith("src");
    expect(el.load).toHaveBeenCalledOnce();
  });

  it("does not stop UI sounds", () => {
    playUISound("error");
    const el = lastAudio()!;
    stopAllSfx();
    expect(el.pause).not.toHaveBeenCalled();
  });

  it("does not stop victory stingers", () => {
    playVictory();
    const el = lastAudio()!;
    stopAllSfx();
    expect(el.pause).not.toHaveBeenCalled();
  });

  it("does not stop slice death", () => {
    playSliceDeath();
    const el = lastAudio()!;
    stopAllSfx();
    expect(el.pause).not.toHaveBeenCalled();
  });
});

describe("playCardSound", () => {
  it("plays audio for known card id", () => {
    playCardSound("slash");
    expect(lastAudio()?.play).toHaveBeenCalledOnce();
    expect(lastAudio()?.src).toContain("sword-attack-1.");
  });

  it("does nothing for unknown card id", () => {
    playCardSound("nonexistent-card");
    expect(created).toHaveLength(0);
  });
});

describe("playGoldGain", () => {
  it("plays gold gain audio", () => {
    playGoldGain();
    expect(lastAudio()?.src).toContain("coins-gather-quick.");
    expect(lastAudio()?.play).toHaveBeenCalledOnce();
  });
});

describe("playGoldSpend", () => {
  it("plays gold spend audio via shopBuy sound", () => {
    playGoldSpend();
    expect(lastAudio()?.src).toContain("coins-gather-quick.");
    expect(lastAudio()?.play).toHaveBeenCalledOnce();
  });
});

describe("playEnemyAttack", () => {
  it("plays audio for known enemy id", () => {
    playEnemyAttack("skeleton");
    expect(lastAudio()?.src).toContain("swish-hit.");
    expect(lastAudio()?.play).toHaveBeenCalledOnce();
  });

  it("does nothing for unknown enemy id", () => {
    playEnemyAttack("nonexistent-enemy");
    expect(created).toHaveLength(0);
  });
});

describe("playBattleEvent", () => {
  it("plays audio for known event", () => {
    playBattleEvent("playerHit");
    expect(lastAudio()?.src).toContain("punch-3.");
    expect(lastAudio()?.play).toHaveBeenCalledOnce();
  });
});

describe("playUISound", () => {
  it("plays audio for known UI sound", () => {
    playUISound("shopBuy");
    expect(lastAudio()?.src).toContain("coins-gather-quick.");
    expect(lastAudio()?.play).toHaveBeenCalledOnce();
  });

  it("plays audio for error sound", () => {
    playUISound("error");
    expect(lastAudio()?.src).toContain("denied-03.");
    expect(lastAudio()?.play).toHaveBeenCalledOnce();
  });

  it("plays salvage with the mine sound", () => {
    expect(uiSounds.salvage).toBe("mine-2.ogg");
    playUISound("salvage");
    expect(lastAudio()?.src).toContain("mine-2.");
    expect(lastAudio()?.play).toHaveBeenCalledOnce();
  });
});

describe("playVictory", () => {
  it("plays victory stinger", () => {
    playVictory();
    expect(lastAudio()?.src).toContain("harpsichord-level-complete.");
    expect(lastAudio()?.play).toHaveBeenCalledOnce();
  });
});

describe("playDefeat", () => {
  it("plays defeat stinger", () => {
    playDefeat();
    expect(lastAudio()?.src).toContain("harpsichord-defeated.");
    expect(lastAudio()?.play).toHaveBeenCalledOnce();
  });
});

describe("playSliceDeath", () => {
  it("plays the sword slice cue", () => {
    playSliceDeath();
    expect(lastAudio()?.src).toContain("sword-slice.");
    expect(lastAudio()?.play).toHaveBeenCalledOnce();
  });
});

describe("in-flight HTMLAudio mute and volume", () => {
  it("mutes a playing combat SFX when background mute turns on", () => {
    playCardSound("slash");
    const el = lastAudio()!;
    expect(el.muted).toBe(false);
    setMuted(true);
    expect(el.muted).toBe(true);
  });

  it("retunes a playing combat SFX when the SFX slider changes", () => {
    playCardSound("slash");
    const el = lastAudio()!;
    const startedAt = el.volume;
    setSfxVolume(1);
    expect(el.volume).toBeGreaterThan(startedAt);
  });

  it("retunes a playing combat SFX when master volume changes", () => {
    playCardSound("slash");
    const el = lastAudio()!;
    setMasterVolume(0.5);
    expect(el.volume).toBeCloseTo(0.35 * 0.5);
  });

  it("mutes in-flight UI SFX that are not stopped on screen change", () => {
    playUISound("error");
    const el = lastAudio()!;
    setMuted(true);
    expect(el.muted).toBe(true);
    stopAllSfx();
    expect(el.pause).not.toHaveBeenCalled();
  });
});
