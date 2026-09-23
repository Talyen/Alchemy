import {
  battleEventSounds,
  getCardSounds,
  enemyAttackSounds,
  stingerSounds,
  uiSounds,
  type UISound,
} from "./sound-registry";
import { audioState } from "./state";
import { getSoundUrl } from "./url";
import { releaseAudioElement } from "./element";
import { clamp01 } from "../math";
import { pickRandomUnsafe } from "../rng";
import {
  SFX_COOLDOWN_MS,
  SFX_DEFEAT_VOLUME,
  SFX_SLICE_DEATH_VOLUME,
  SFX_UI_VOLUME,
  SFX_VICTORY_VOLUME,
} from "../game-constants";

interface PlaySoundOptions {
  volume?: number;
  delay?: number;
  cooldownMs?: number;

  trackForCleanup?: boolean;
}

interface ActiveHtmlSfx {
  el: HTMLAudioElement;
  volume: number;
  trackForCleanup: boolean;
}

interface PendingHtmlSfx {
  timer: ReturnType<typeof setTimeout>;
  trackForCleanup: boolean;
}

/**
 * Live SFX elements. `trackForCleanup` sounds (combat) are stopped on screen
 * changes; fire-and-forget sounds (UI clicks, stingers, slice deaths) survive
 * by design. The set is bounded for fire-and-forget entries: entries leave on
 * ended/error/rejected play, and the oldest is paused out if a burst ever
 * exceeds the cap (e.g. a stuck ended handler).
 */
const activeHtmlSfx = new Set<ActiveHtmlSfx>();
const pendingHtmlSfx = new Set<PendingHtmlSfx>();
const MAX_AMBIENT_SFX = 32;

function releaseCooldownReservation(name: string, playedAt: number) {
  if (audioState.lastPlayedAt.get(name) === playedAt) audioState.lastPlayedAt.delete(name);
}

function cancelPendingHtmlSfx(onlyTracked: boolean) {
  for (const pending of pendingHtmlSfx) {
    if (onlyTracked && !pending.trackForCleanup) continue;
    clearTimeout(pending.timer);
    pendingHtmlSfx.delete(pending);
  }
}

function htmlSfxVolume(volume: number): number {
  return clamp01(volume * audioState.sfxVolume * audioState.masterVolume);
}

function applyHtmlSfxPlayback(entry: ActiveHtmlSfx) {
  entry.el.muted = audioState.muted;
  entry.el.volume = htmlSfxVolume(entry.volume);
}

function trackHtmlSfx(entry: ActiveHtmlSfx) {
  if (!entry.trackForCleanup) {
    let ambientCount = 0;
    let oldestAmbient: ActiveHtmlSfx | undefined;
    for (const live of activeHtmlSfx) {
      if (live.trackForCleanup) continue;
      ambientCount += 1;
      oldestAmbient ??= live;
    }
    if (ambientCount >= MAX_AMBIENT_SFX && oldestAmbient) {
      releaseAudioElement(oldestAmbient.el);
      activeHtmlSfx.delete(oldestAmbient);
    }
  }
  activeHtmlSfx.add(entry);
}

function untrackHtmlSfx(entry: ActiveHtmlSfx) {
  activeHtmlSfx.delete(entry);
}

export function syncActiveHtmlSfxPlayback() {
  for (const entry of activeHtmlSfx) {
    applyHtmlSfxPlayback(entry);
  }
}

export function resetHtmlSfxRuntime() {
  cancelPendingHtmlSfx(false);
  activeHtmlSfx.clear();
}

export function stopAllSfx() {
  cancelPendingHtmlSfx(true);
  for (const entry of Array.from(activeHtmlSfx)) {
    if (!entry.trackForCleanup) continue;
    releaseAudioElement(entry.el);
    activeHtmlSfx.delete(entry);
  }
}

function playHtmlSfx(name: string, volume: number, trackForCleanup: boolean, onFailure: () => void): boolean {
  if (typeof Audio === "undefined") return false;
  let el: HTMLAudioElement;
  try {
    el = new Audio(getSoundUrl(name));
  } catch {
    return false;
  }
  const entry: ActiveHtmlSfx = { el, volume, trackForCleanup };
  applyHtmlSfxPlayback(entry);
  trackHtmlSfx(entry);
  el.onended = () => {
    untrackHtmlSfx(entry);
  };
  el.onerror = () => {
    untrackHtmlSfx(entry);
  };
  try {
    void Promise.resolve(el.play()).catch(() => {
      untrackHtmlSfx(entry);
      releaseAudioElement(el);
      onFailure();
    });
  } catch {
    untrackHtmlSfx(entry);
    releaseAudioElement(el);
    return false;
  }
  return true;
}

function playBuffer(
  name: string,
  { volume = 1.0, delay = 0, cooldownMs = SFX_COOLDOWN_MS, trackForCleanup = true }: PlaySoundOptions = {},
) {
  if (audioState.muted) return;

  let pending: PendingHtmlSfx | undefined;
  const start = () => {
    if (pending) pendingHtmlSfx.delete(pending);
    if (audioState.muted) return;
    const playedAt = performance.now();
    // Check when the sound starts: a future cue must not suppress a cue that
    // plays now, and canceled cues must not consume a cooldown.
    const last = audioState.lastPlayedAt.get(name) ?? Number.NEGATIVE_INFINITY;
    if (playedAt - last < cooldownMs) return;
    if (playHtmlSfx(name, volume, trackForCleanup, () => releaseCooldownReservation(name, playedAt))) {
      audioState.lastPlayedAt.set(name, playedAt);
    }
  };

  if (delay > 0) {
    const timer = globalThis.setTimeout(start, delay * 1000);
    pending = { timer, trackForCleanup };
    pendingHtmlSfx.add(pending);
    return;
  }
  start();
}

export function playCardSound(cardId: string) {
  const sound = pickRandomUnsafe(getCardSounds(cardId));
  if (!sound) return;
  playBuffer(sound);
}

export function playGoldGain() {
  playBattleEvent("gainGold");
}

export function playGoldSpend() {
  playUISound("shopBuy");
}

export function playEnemyAttack(enemyId: string) {
  const sound = pickRandomUnsafe(enemyAttackSounds[enemyId] ?? []);
  if (!sound) return;
  playBuffer(sound);
}

export function playBattleEvent(event: keyof typeof battleEventSounds, options: PlaySoundOptions = {}) {
  playBuffer(battleEventSounds[event], options);
}

export function playSliceDeath() {
  playBattleEvent("sliceDeath", { volume: SFX_SLICE_DEATH_VOLUME, trackForCleanup: false });
}

export function playUISound(event: UISound) {
  playBuffer(uiSounds[event], { volume: SFX_UI_VOLUME, trackForCleanup: false });
}

export function playVictory() {
  playBuffer(stingerSounds.victory, { volume: SFX_VICTORY_VOLUME, trackForCleanup: false });
}

export function playDefeat() {
  playBuffer(stingerSounds.defeat, { volume: SFX_DEFEAT_VOLUME, trackForCleanup: false });
}
