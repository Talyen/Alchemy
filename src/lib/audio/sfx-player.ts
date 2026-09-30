import { SFX_COOLDOWN_MS } from "../game-constants";
import { clamp01 } from "../math";
import { releaseAudioElement } from "./element";

export interface PlaySoundOptions {
  volume?: number;
  delay?: number;
  cooldownMs?: number;
  trackForCleanup?: boolean;
}

interface SfxSettings {
  muted: boolean;
  sfxVolume: number;
  masterVolume: number;
}

interface SfxPlayerDependencies {
  createElement: (name: string) => HTMLAudioElement | undefined;
  readSettings: () => SfxSettings;
  now: () => number;
  schedule: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  cancel: (timer: ReturnType<typeof setTimeout>) => void;
}

interface CooldownReservation {
  playedAt: number;
}

type CueState =
  | { phase: "ready" }
  | { phase: "pending"; timer: ReturnType<typeof setTimeout> }
  | { phase: "playing"; element: HTMLAudioElement }
  | { phase: "finished" };

interface Cue {
  trackForCleanup: boolean;
  volume: number;
  state: CueState;
}

const MAX_AMBIENT_SFX = 32;

/** Owns every cue from scheduling through disposal; semantic sound selection stays in sfx.ts. */
export function createSfxPlayer(deps: SfxPlayerDependencies) {
  const cues = new Set<Cue>();
  const cooldowns = new Map<string, CooldownReservation>();

  function finish(cue: Cue, release = true): boolean {
    const state = cue.state;
    if (state.phase === "finished") return false;
    cue.state = { phase: "finished" };
    cues.delete(cue);
    if (state.phase === "pending") deps.cancel(state.timer);
    if (state.phase === "playing") {
      state.element.onended = null;
      state.element.onerror = null;
      if (release) releaseAudioElement(state.element);
    }
    return true;
  }

  function syncCue(cue: Cue): void {
    if (cue.state.phase !== "playing") return;
    const settings = deps.readSettings();
    cue.state.element.muted = settings.muted;
    cue.state.element.volume = clamp01(cue.volume * settings.sfxVolume * settings.masterVolume);
  }

  function boundAmbientPlayback(): void {
    const ambient = [...cues].filter((cue) => !cue.trackForCleanup && cue.state.phase === "playing");
    for (const cue of ambient.slice(0, Math.max(0, ambient.length - MAX_AMBIENT_SFX))) finish(cue);
  }

  function play(
    name: string,
    { volume = 1, delay = 0, cooldownMs = SFX_COOLDOWN_MS, trackForCleanup = true }: PlaySoundOptions = {},
  ): void {
    if (deps.readSettings().muted) return;
    const cue: Cue = { volume, trackForCleanup, state: { phase: "ready" } };
    const start = () => {
      // A queued timer must not revive a cancelled cue.
      if (!cues.has(cue)) return;
      const playedAt = deps.now();
      const last = cooldowns.get(name)?.playedAt ?? Number.NEGATIVE_INFINITY;
      if (deps.readSettings().muted || playedAt - last < cooldownMs) {
        finish(cue);
        return;
      }
      let element: HTMLAudioElement | undefined;
      try {
        element = deps.createElement(name);
      } catch {
        finish(cue);
        return;
      }
      if (!element) {
        finish(cue);
        return;
      }
      cue.state = { phase: "playing", element };
      // Identity, rather than clock equality, protects a newer play from an
      // older failure, even when two plays occur in the same clock tick.
      const reservation = { playedAt };
      cooldowns.set(name, reservation);
      const fail = () => {
        if (!finish(cue)) return;
        if (cooldowns.get(name) === reservation) cooldowns.delete(name);
      };
      element.onended = () => finish(cue, false);
      element.onerror = fail;
      try {
        syncCue(cue);
        boundAmbientPlayback();
        void Promise.resolve(element.play()).catch(fail);
      } catch {
        fail();
      }
    };
    if (delay > 0) {
      cue.state = { phase: "pending", timer: deps.schedule(start, delay * 1000) };
    } else {
      cues.add(cue);
      start();
      return;
    }
    cues.add(cue);
  }

  return {
    play,
    syncSettings() {
      for (const cue of cues) syncCue(cue);
    },
    stopBattleSounds() {
      for (const cue of cues) if (cue.trackForCleanup) finish(cue);
    },
    reset() {
      for (const cue of cues) finish(cue);
      cooldowns.clear();
    },
  };
}
