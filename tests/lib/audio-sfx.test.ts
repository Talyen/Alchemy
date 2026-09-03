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
} from "@/lib/audio-sfx";
import { setMasterVolume, setMuted, setSfxVolume } from "@/lib/audio-volume";
import {
  createdFakeAudio,
  installFakeAudio,
  lastFakeAudio,
  resetSfxRuntime,
  soundedFakeAudio,
} from "../helpers/fake-audio";

beforeEach(() => {
  audioState.sfxVolume = 0.35;
  audioState.masterVolume = 1;
  resetSfxRuntime();
  installFakeAudio();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("stopAllSfx", () => {
  it("runs without error when no active sources", () => {
    expect(() => stopAllSfx()).not.toThrow();
  });

  it("stops battle-tracked sources", () => {
    playCardSound("slash");
    const el = lastFakeAudio()!;
    stopAllSfx();
    expect(el.pause).toHaveBeenCalledOnce();
    expect(el.removeAttribute).toHaveBeenCalledWith("src");
    expect(el.load).toHaveBeenCalledOnce();
  });

  it("does not stop UI sounds", () => {
    playUISound("error");
    const el = lastFakeAudio()!;
    stopAllSfx();
    expect(el.pause).not.toHaveBeenCalled();
  });

  it("does not stop victory stingers", () => {
    playVictory();
    const el = lastFakeAudio()!;
    stopAllSfx();
    expect(el.pause).not.toHaveBeenCalled();
  });

  it("does not stop slice death", () => {
    playSliceDeath();
    const el = lastFakeAudio()!;
    stopAllSfx();
    expect(el.pause).not.toHaveBeenCalled();
  });
});

describe("playCardSound", () => {
  it("plays audio for known card id", () => {
    playCardSound("slash");
    expect(lastFakeAudio()?.play).toHaveBeenCalledOnce();
    expect(lastFakeAudio()?.src).toContain("sword-attack-1.");
  });

  it("does nothing for unknown card id", () => {
    playCardSound("nonexistent-card");
    expect(createdFakeAudio).toHaveLength(0);
  });
});

describe("playGoldGain", () => {
  it("plays gold gain audio", () => {
    playGoldGain();
    expect(lastFakeAudio()?.src).toContain("coins-gather-quick.");
    expect(lastFakeAudio()?.play).toHaveBeenCalledOnce();
  });
});

describe("playGoldSpend", () => {
  it("plays gold spend audio via shopBuy sound", () => {
    playGoldSpend();
    expect(lastFakeAudio()?.src).toContain("coins-gather-quick.");
    expect(lastFakeAudio()?.play).toHaveBeenCalledOnce();
  });
});

describe("playEnemyAttack", () => {
  it("plays audio for known enemy id", () => {
    playEnemyAttack("skeleton");
    expect(lastFakeAudio()?.src).toContain("swish-hit.");
    expect(lastFakeAudio()?.play).toHaveBeenCalledOnce();
  });

  it("does nothing for unknown enemy id", () => {
    playEnemyAttack("nonexistent-enemy");
    expect(createdFakeAudio).toHaveLength(0);
  });
});

describe("playBattleEvent", () => {
  it("plays audio for known event", () => {
    playBattleEvent("playerHit");
    expect(lastFakeAudio()?.src).toContain("punch-3.");
    expect(lastFakeAudio()?.play).toHaveBeenCalledOnce();
  });
});

describe("playUISound", () => {
  it("plays audio for known UI sound", () => {
    playUISound("shopBuy");
    expect(lastFakeAudio()?.src).toContain("coins-gather-quick.");
    expect(lastFakeAudio()?.play).toHaveBeenCalledOnce();
  });

  it("plays audio for error sound", () => {
    playUISound("error");
    expect(lastFakeAudio()?.src).toContain("denied-03.");
    expect(lastFakeAudio()?.play).toHaveBeenCalledOnce();
  });

  it("plays salvage with the mine sound", () => {
    expect(uiSounds.salvage).toBe("mine-2.ogg");
    playUISound("salvage");
    expect(lastFakeAudio()?.src).toContain("mine-2.");
    expect(lastFakeAudio()?.play).toHaveBeenCalledOnce();
  });
});

describe("playVictory", () => {
  it("plays victory stinger", () => {
    playVictory();
    expect(lastFakeAudio()?.src).toContain("harpsichord-level-complete.");
    expect(lastFakeAudio()?.play).toHaveBeenCalledOnce();
  });
});

describe("playDefeat", () => {
  it("plays defeat stinger", () => {
    playDefeat();
    expect(lastFakeAudio()?.src).toContain("harpsichord-defeated.");
    expect(lastFakeAudio()?.play).toHaveBeenCalledOnce();
  });
});

describe("playSliceDeath", () => {
  it("plays the sword slice cue", () => {
    playSliceDeath();
    expect(lastFakeAudio()?.src).toContain("sword-slice.");
    expect(lastFakeAudio()?.play).toHaveBeenCalledOnce();
  });
});

describe("cold runtime playback", () => {
  it("does not no-op UI, combat, or victory SFX from a cold runtime", () => {
    playUISound("error");
    playBattleEvent("enemyHit");
    playVictory();

    expect(soundedFakeAudio()).toHaveLength(3);
    expect(soundedFakeAudio().some((el) => el.src.includes("denied-03."))).toBe(true);
    expect(soundedFakeAudio().some((el) => el.src.includes("sword-impact-hit-1."))).toBe(true);
    expect(soundedFakeAudio().some((el) => el.src.includes("harpsichord-level-complete."))).toBe(true);
  });

  it("does not play when muted", () => {
    audioState.muted = true;
    playUISound("error");
    expect(createdFakeAudio).toHaveLength(0);
  });
});

describe("cooldown, delay, and stop tokens", () => {
  it("suppresses a repeat play inside the cooldown window", () => {
    playCardSound("slash");
    playCardSound("slash");
    expect(soundedFakeAudio()).toHaveLength(1);
  });

  it("honors an explicit zero cooldown", () => {
    playBattleEvent("playerHit", { cooldownMs: 0 });
    playBattleEvent("playerHit", { cooldownMs: 0 });
    expect(soundedFakeAudio()).toHaveLength(2);
  });

  it("defers playback until the delay elapses", () => {
    vi.useFakeTimers();
    playBattleEvent("playerHit", { delay: 1, cooldownMs: 0 });
    expect(soundedFakeAudio()).toHaveLength(0);
    vi.advanceTimersByTime(1000);
    expect(soundedFakeAudio()).toHaveLength(1);
  });

  it("cancels a delayed play when the stop token moves", () => {
    vi.useFakeTimers();
    playBattleEvent("playerHit", { delay: 1, cooldownMs: 0 });
    stopAllSfx();
    vi.advanceTimersByTime(1000);
    expect(soundedFakeAudio()).toHaveLength(0);
  });

  it("skips a delayed play muted after scheduling", () => {
    vi.useFakeTimers();
    playBattleEvent("playerHit", { delay: 1, cooldownMs: 0 });
    setMuted(true);
    vi.advanceTimersByTime(1000);
    expect(soundedFakeAudio()).toHaveLength(0);
  });
});

describe("SFX lifetime", () => {
  it("releases an ended element from later stops", () => {
    playCardSound("slash");
    const el = lastFakeAudio()!;
    el.onended?.();
    stopAllSfx();
    expect(el.pause).not.toHaveBeenCalled();
  });

  it("releases a failed element from later stops", () => {
    playCardSound("slash");
    const el = lastFakeAudio()!;
    el.onerror?.();
    stopAllSfx();
    expect(el.pause).not.toHaveBeenCalled();
  });

  it("releases an element whose play rejects", async () => {
    installFakeAudio({ rejectPlay: true });
    playCardSound("slash");
    const el = lastFakeAudio()!;
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    stopAllSfx();
    expect(el.pause).not.toHaveBeenCalled();
  });
});

describe("in-flight HTMLAudio mute and volume", () => {
  it("mutes a playing combat SFX when background mute turns on", () => {
    playCardSound("slash");
    const el = lastFakeAudio()!;
    expect(el.muted).toBe(false);
    setMuted(true);
    expect(el.muted).toBe(true);
  });

  it("retunes a playing combat SFX when the SFX slider changes", () => {
    playCardSound("slash");
    const el = lastFakeAudio()!;
    const startedAt = el.volume;
    setSfxVolume(1);
    expect(el.volume).toBeGreaterThan(startedAt);
  });

  it("retunes a playing combat SFX when master volume changes", () => {
    playCardSound("slash");
    const el = lastFakeAudio()!;
    setMasterVolume(0.5);
    expect(el.volume).toBeCloseTo(0.35 * 0.5);
  });

  it("mutes in-flight UI SFX that are not stopped on screen change", () => {
    playUISound("error");
    const el = lastFakeAudio()!;
    setMuted(true);
    expect(el.muted).toBe(true);
    stopAllSfx();
    expect(el.pause).not.toHaveBeenCalled();
  });
});
