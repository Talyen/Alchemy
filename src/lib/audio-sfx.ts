// Short sound-effect playback for cards, combat events, UI, and stingers.
// SFX use HTMLAudioElement, the same path as music, because Web Audio can unlock
// and still emit silence while streamed music plays.
import {
  battleEventSounds,
  cardSounds,
  enemyAttackSounds,
  stingerSounds,
  uiSounds,
  type UISound,
} from "./sound-registry";
import { audioState } from "./audio-state";
import { getSoundUrl } from "./audio-preload";
import { clamp, pickRandom } from "./utils";
import {
  SFX_COOLDOWN_MS,
  SFX_DEFEAT_VOLUME,
  SFX_SLICE_DEATH_VOLUME,
  SFX_UI_VOLUME,
  SFX_VICTORY_VOLUME,
} from "./game-constants";

interface PlaySoundOptions {
  volume?: number;
  delay?: number;
  cooldownMs?: number;
  /** When false, sound plays through screen transitions (UI feedback, stingers). Default true for combat SFX. */
  trackForCleanup?: boolean;
}

interface ActiveHtmlSfx {
  el: HTMLAudioElement;
  volume: number;
  trackForCleanup: boolean;
}

const activeHtmlSfx = new Set<ActiveHtmlSfx>();
let sfxStopToken = 0;

function htmlSfxVolume(volume: number): number {
  return clamp(volume * audioState.sfxVolume * audioState.masterVolume, 0, 1);
}

function applyHtmlSfxPlayback(entry: ActiveHtmlSfx) {
  entry.el.muted = audioState.muted;
  entry.el.volume = htmlSfxVolume(entry.volume);
}

/** Apply current mute and SFX/master volume to in-flight HTMLAudio SFX. */
export function syncActiveHtmlSfxPlayback() {
  for (const entry of activeHtmlSfx) {
    applyHtmlSfxPlayback(entry);
  }
}

/** Test-only: module elements would otherwise leak stub Audio across cases. */
export function resetHtmlSfxRuntime() {
  activeHtmlSfx.clear();
}

export function stopAllSfx() {
  sfxStopToken += 1;
  for (const entry of activeHtmlSfx) {
    if (!entry.trackForCleanup) continue;
    entry.el.pause();
    // Clearing via removeAttribute avoids browsers re-fetching the page URL as media.
    entry.el.removeAttribute("src");
    entry.el.load();
    activeHtmlSfx.delete(entry);
  }
}

function playHtmlSfx(name: string, volume: number, trackForCleanup: boolean) {
  if (typeof Audio === "undefined") return;
  const el = new Audio(getSoundUrl(name));
  const entry: ActiveHtmlSfx = { el, volume, trackForCleanup };
  applyHtmlSfxPlayback(entry);
  activeHtmlSfx.add(entry);
  el.onended = () => {
    activeHtmlSfx.delete(entry);
  };
  el.onerror = () => {
    activeHtmlSfx.delete(entry);
  };
  void Promise.resolve(el.play()).catch(() => {
    activeHtmlSfx.delete(entry);
  });
}

function playBuffer(
  name: string,
  { volume = 1.0, delay = 0, cooldownMs = SFX_COOLDOWN_MS, trackForCleanup = true }: PlaySoundOptions = {},
) {
  if (audioState.muted) return;

  const playToken = sfxStopToken;
  const scheduledAt = performance.now() + delay * 1000;
  const last = audioState.lastPlayedAt.get(name) ?? 0;
  if (scheduledAt - last < cooldownMs) return;
  audioState.lastPlayedAt.set(name, scheduledAt);

  const start = () => {
    if (audioState.muted) return;
    if (trackForCleanup && playToken !== sfxStopToken) return;
    playHtmlSfx(name, volume, trackForCleanup);
  };

  if (delay > 0) {
    globalThis.setTimeout(start, delay * 1000);
    return;
  }
  start();
}

export function playCardSound(cardId: string) {
  const sound = pickRandom(cardSounds[cardId] ?? []);
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
  const sound = pickRandom(enemyAttackSounds[enemyId] ?? []);
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
