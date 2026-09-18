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

/**
 * Live SFX elements. `trackForCleanup` sounds (combat) are stopped on screen
 * changes; fire-and-forget sounds (UI clicks, stingers, slice deaths) survive
 * by design. The set is bounded for fire-and-forget entries: entries leave on
 * ended/error/rejected play, and the oldest is paused out if a burst ever
 * exceeds the cap (e.g. a stuck ended handler).
 */
const activeHtmlSfx = new Set<ActiveHtmlSfx>();
const MAX_AMBIENT_SFX = 32;
let sfxStopToken = 0;

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
  // Bump the stop token so delayed plays scheduled before the reset cannot
  // fire afterwards. Production never calls this; tests rely on it.
  sfxStopToken += 1;
  activeHtmlSfx.clear();
}

export function stopAllSfx() {
  sfxStopToken += 1;
  for (const entry of Array.from(activeHtmlSfx)) {
    if (!entry.trackForCleanup) continue;
    releaseAudioElement(entry.el);
    activeHtmlSfx.delete(entry);
  }
}

function playHtmlSfx(name: string, volume: number, trackForCleanup: boolean) {
  if (typeof Audio === "undefined") return;
  const el = new Audio(getSoundUrl(name));
  const entry: ActiveHtmlSfx = { el, volume, trackForCleanup };
  applyHtmlSfxPlayback(entry);
  trackHtmlSfx(entry);
  el.onended = () => {
    untrackHtmlSfx(entry);
  };
  el.onerror = () => {
    untrackHtmlSfx(entry);
  };
  void Promise.resolve(el.play()).catch(() => {
    untrackHtmlSfx(entry);
  });
}

function playBuffer(
  name: string,
  { volume = 1.0, delay = 0, cooldownMs = SFX_COOLDOWN_MS, trackForCleanup = true }: PlaySoundOptions = {},
) {
  if (audioState.muted) return;

  const playToken = sfxStopToken;
  const scheduledAt = performance.now() + delay * 1000;
  // Default to -Infinity (not 0) so the first play always passes: a zero
  // clock (page load, fake timers) would otherwise read as "just played"
  // and swallow the first sound inside the cooldown window.
  const last = audioState.lastPlayedAt.get(name) ?? Number.NEGATIVE_INFINITY;
  if (scheduledAt - last < cooldownMs) return;
  audioState.lastPlayedAt.set(name, scheduledAt);

  const start = () => {
    if (audioState.muted || (trackForCleanup && playToken !== sfxStopToken)) {
      // A cancelled delayed play must not poison the cooldown for the next
      // immediate retry. Only release the reservation this schedule made.
      if (audioState.lastPlayedAt.get(name) === scheduledAt) audioState.lastPlayedAt.delete(name);
      return;
    }
    playHtmlSfx(name, volume, trackForCleanup);
  };

  if (delay > 0) {
    globalThis.setTimeout(start, delay * 1000);
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
